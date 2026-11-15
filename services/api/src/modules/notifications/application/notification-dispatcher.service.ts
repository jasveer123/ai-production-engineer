import { Inject, Injectable } from '@nestjs/common';
import { and, arrayContains, eq } from 'drizzle-orm';
import type { DeliveryChannel } from '@ape/api-contracts';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { incidentEvents, incidents, notificationChannels } from '../../../core/db/schema';
import {
  maskPhone,
  maskTarget,
  notificationTypeFor,
  severityAtLeast,
  type IncidentSnapshot,
  type Notification,
} from '../domain/messages';
import type { ChannelRow } from '../infrastructure/notification-sender.service';
import { DeliveryLedger, type AttemptRow, type NewAttempt } from './delivery-ledger.service';

export const deliveryChannelOf = (kind: string): DeliveryChannel =>
  kind === 'phone' ? 'call' : (kind as DeliveryChannel);

export function channelDisplay(channel: ChannelRow): string {
  if (channel.kind === 'slack') return `Slack · ${channel.name}`;
  if (channel.kind === 'sms' || channel.kind === 'phone') return maskPhone(channel.url ?? '');
  if (channel.kind === 'email') return channel.url ?? '';
  return maskTarget('webhook', channel.url ?? '');
}

export function channelAttempt(
  channel: ChannelRow,
  n: Notification,
  extra: Partial<NewAttempt> & { dedupKey: string },
): NewAttempt {
  return {
    workspaceId: channel.workspaceId,
    incidentId: n.key.startsWith('test:') ? null : n.incident.id,
    channelId: channel.id,
    eventType: n.type,
    channel: deliveryChannelOf(channel.kind),
    address: channelDisplay(channel),
    recipientName: channel.name,
    payload: n,
    ...extra,
  };
}

@Injectable()
export class NotificationDispatcher {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly ledger: DeliveryLedger,
  ) {}

  incidentUrl(workspaceId: string, incidentId: string) {
    return `${this.env.WEB_URL}/w/${workspaceId}/incidents/${incidentId}`;
  }

  async dispatch(payload: { incidentEventId: string }): Promise<number> {
    const [row] = await this.db
      .select({ event: incidentEvents, incident: incidents })
      .from(incidentEvents)
      .innerJoin(incidents, eq(incidents.id, incidentEvents.incidentId))
      .where(eq(incidentEvents.id, payload.incidentEventId));
    if (!row) return 0;
    const type = notificationTypeFor(row.event);
    if (!type) return 0;

    const incident: IncidentSnapshot = {
      id: row.incident.id,
      workspaceId: row.incident.workspaceId,
      title: row.incident.title,
      severity: row.incident.severity,
      status:
        typeof row.event.attributes.to === 'string' ? row.event.attributes.to : row.incident.status,
      serviceName: row.incident.serviceName,
      environment: row.incident.environment,
    };
    const n: Notification = {
      type,
      key: `evt:${row.event.id}`,
      occurredAt: row.event.occurredAt.toISOString(),
      summary: row.event.summary ?? '',
      incident,
      url: this.incidentUrl(incident.workspaceId, incident.id),
    };

    const channels = (
      await this.db
        .select()
        .from(notificationChannels)
        .where(
          and(
            eq(notificationChannels.workspaceId, incident.workspaceId),
            eq(notificationChannels.enabled, true),
            arrayContains(notificationChannels.events, [type]),
          ),
        )
    ).filter((c) => severityAtLeast(incident.severity, c.minSeverity));

    const ids = await this.ledger.enqueue(
      this.db,
      channels.map((c) => channelAttempt(c, n, { dedupKey: `${c.id}:${n.key}` })),
    );
    await this.ledger.deliverNow(ids);
    return ids.length;
  }

  async deliverOnce(channel: ChannelRow, n: Notification): Promise<AttemptRow | undefined> {
    const ids = await this.ledger.enqueue(this.db, [
      channelAttempt(channel, n, { dedupKey: n.key, incidentId: null }),
    ]);
    const [row] = await this.ledger.deliverNow(ids);
    return row;
  }
}
