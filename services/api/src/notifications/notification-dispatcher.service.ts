import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, arrayContains, eq, sql } from 'drizzle-orm';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import {
  incidentEvents,
  incidents,
  notificationChannels,
  notificationDeliveries,
} from '../db/schema';
import {
  notificationTypeFor,
  severityAtLeast,
  type IncidentSnapshot,
  type Notification,
} from './messages';
import {
  NotificationSender,
  type ChannelRow,
  type SendResult,
} from './notification-sender.service';

export class RetryableDeliveryError extends Error {}

/**
 * Turns a `notify` outbox row (one incident timeline event) into deliveries for every matching
 * channel. Throws when a delivery should be retried, so the outbox backs off and calls again;
 * channels that already received the event are skipped on that retry.
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly sender: NotificationSender,
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
      // The status this event announced, not whatever the incident has moved on to since.
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

    let sent = 0;
    const retry: string[] = [];
    for (const channel of channels) {
      const [done] = await this.db
        .select({ status: notificationDeliveries.status })
        .from(notificationDeliveries)
        .where(
          and(
            eq(notificationDeliveries.channelId, channel.id),
            eq(notificationDeliveries.eventKey, n.key),
          ),
        );
      if (done?.status === 'sent') continue;
      const result = await this.deliver(channel, n);
      if (result.ok) sent++;
      else if (!result.permanent) retry.push(channel.name);
    }
    if (retry.length > 0) {
      throw new RetryableDeliveryError(`Delivery to ${retry.join(', ')} failed; will retry`);
    }
    return sent;
  }

  /** Sends and records one delivery (upsert per channel and event key). */
  async deliver(channel: ChannelRow, n: Notification): Promise<SendResult> {
    const result = await this.sender.send(channel, n);
    const now = new Date();
    await this.db
      .insert(notificationDeliveries)
      .values({
        workspaceId: channel.workspaceId,
        channelId: channel.id,
        eventKey: n.key,
        eventType: n.type,
        incidentId: n.key.startsWith('test:') ? null : n.incident.id,
        status: result.ok ? 'sent' : 'failed',
        responseStatus: result.status,
        error: result.error,
        sentAt: result.ok ? now : null,
      })
      .onConflictDoUpdate({
        target: [notificationDeliveries.channelId, notificationDeliveries.eventKey],
        set: {
          status: result.ok ? 'sent' : 'failed',
          attempts: sql`${notificationDeliveries.attempts} + 1`,
          responseStatus: result.status,
          error: result.error,
          sentAt: result.ok ? now : null,
        },
      });
    await this.db
      .update(notificationChannels)
      .set(result.ok ? { lastDeliveryAt: now, lastError: null } : { lastError: result.error })
      .where(eq(notificationChannels.id, channel.id));
    if (!result.ok) this.logger.warn(`Notification to "${channel.name}" failed: ${result.error}`);
    return result;
  }
}
