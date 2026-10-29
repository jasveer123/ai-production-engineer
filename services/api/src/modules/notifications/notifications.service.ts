import { randomBytes, randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import type {
  CreateNotificationChannelInput,
  NotificationChannel,
  NotificationChannelWithSecret,
  NotificationDelivery,
  NotificationEvent,
  NotificationTestResult,
  UpdateNotificationChannelInput,
} from '@ape/api-contracts';
import { AuditService } from '../../core/audit/audit.service';
import { ApiException, notFound } from '../../core/common/errors';
import type { ActorContext } from '../../core/common/request-context';
import { ENV, type ApiEnv } from '../../core/config/config.module';
import { DB } from '../../core/db/database.module';
import type { Database } from '../../core/db/client';
import { notificationChannels, notificationDeliveries } from '../../core/db/schema';
import { SecretStore } from '../../core/secrets/secret-store.service';
import { maskTarget } from './domain/messages';
import { NotificationDispatcher } from './application/notification-dispatcher.service';
import type { ChannelRow } from './infrastructure/notification-sender.service';
import { checkOutboundUrl, UnsafeUrlError } from './infrastructure/outbound-url';

const MAX_CHANNELS = 20;

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly secrets: SecretStore,
    private readonly audit: AuditService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  private toDto(r: ChannelRow, slackUrl?: string): NotificationChannel {
    return {
      id: r.id,
      kind: r.kind as NotificationChannel['kind'],
      name: r.name,
      target:
        r.kind === 'slack'
          ? slackUrl
            ? maskTarget('slack', slackUrl)
            : 'hooks.slack.com/services/…'
          : maskTarget('webhook', r.url ?? ''),
      events: r.events as NotificationEvent[],
      minSeverity: r.minSeverity,
      enabled: r.enabled,
      lastDeliveryAt: r.lastDeliveryAt?.toISOString() ?? null,
      lastError: r.lastError,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private async find(actor: ActorContext, id: string): Promise<ChannelRow> {
    const [row] = await this.db
      .select()
      .from(notificationChannels)
      .where(
        and(
          eq(notificationChannels.id, id),
          eq(notificationChannels.workspaceId, actor.workspaceId),
        ),
      );
    if (!row) throw notFound('Notification channel');
    return row;
  }

  private record(actor: ActorContext, action: string, id: string, metadata = {}) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'notification_channel',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata,
    });
  }

  async list(actor: ActorContext): Promise<NotificationChannel[]> {
    const rows = await this.db
      .select()
      .from(notificationChannels)
      .where(eq(notificationChannels.workspaceId, actor.workspaceId))
      .orderBy(asc(notificationChannels.createdAt));
    return Promise.all(
      rows.map(async (r) =>
        this.toDto(
          r,
          r.kind === 'slack' && r.secretReference
            ? await this.secrets.get(r.workspaceId, r.secretReference)
            : undefined,
        ),
      ),
    );
  }

  async create(
    actor: ActorContext,
    input: CreateNotificationChannelInput,
  ): Promise<NotificationChannelWithSecret> {
    const existing = await this.db
      .select({ id: notificationChannels.id })
      .from(notificationChannels)
      .where(eq(notificationChannels.workspaceId, actor.workspaceId));
    if (existing.length >= MAX_CHANNELS) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'too_many_channels',
        `A workspace can have at most ${MAX_CHANNELS} notification channels`,
      );
    }
    const target = input.kind === 'slack' ? input.webhookUrl : input.url;
    try {
      await checkOutboundUrl(target, { allowPrivate: this.env.NODE_ENV !== 'production' });
    } catch (err) {
      if (err instanceof UnsafeUrlError)
        throw new ApiException(HttpStatus.BAD_REQUEST, 'unsafe_url', err.message);
      throw err;
    }

    const signingSecret =
      input.kind === 'webhook' ? `whsec_${randomBytes(32).toString('hex')}` : null;
    const row = await this.db.transaction(async (tx) => {
      const secretReference = await this.secrets.put(
        actor.workspaceId,
        input.kind === 'slack' ? input.webhookUrl : signingSecret!,
        tx,
      );
      const [r] = await tx
        .insert(notificationChannels)
        .values({
          workspaceId: actor.workspaceId,
          kind: input.kind,
          name: input.name,
          url: input.kind === 'webhook' ? input.url : null,
          secretReference,
          events: [...new Set(input.events)],
          minSeverity: input.minSeverity ?? 'low',
          createdBy: actor.userId,
        })
        .returning();
      return r!;
    });
    await this.record(actor, 'notification_channel.created', row.id, {
      kind: input.kind,
      events: row.events,
      minSeverity: row.minSeverity,
    });
    return {
      ...this.toDto(row, input.kind === 'slack' ? input.webhookUrl : undefined),
      signingSecret,
    };
  }

  async update(
    actor: ActorContext,
    id: string,
    input: UpdateNotificationChannelInput,
  ): Promise<NotificationChannel> {
    const before = await this.find(actor, id);
    const [row] = await this.db
      .update(notificationChannels)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.events !== undefined && { events: [...new Set(input.events)] }),
        ...(input.minSeverity !== undefined && { minSeverity: input.minSeverity }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
      })
      .where(
        and(
          eq(notificationChannels.id, before.id),
          eq(notificationChannels.workspaceId, actor.workspaceId),
        ),
      )
      .returning();
    await this.record(actor, 'notification_channel.updated', id, { changes: input });
    return this.toDto(row!);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const row = await this.find(actor, id);
    await this.db.transaction(async (tx) => {
      await tx
        .delete(notificationChannels)
        .where(
          and(
            eq(notificationChannels.id, row.id),
            eq(notificationChannels.workspaceId, actor.workspaceId),
          ),
        );
      if (row.secretReference)
        await this.secrets.delete(actor.workspaceId, row.secretReference, tx);
    });
    await this.record(actor, 'notification_channel.deleted', id, { kind: row.kind });
  }

  async test(actor: ActorContext, id: string): Promise<NotificationTestResult> {
    const row = await this.find(actor, id);
    const incidentId = randomUUID();
    const result = await this.dispatcher.deliver(row, {
      type: 'incident.detected',
      key: `test:${randomUUID()}`,
      occurredAt: new Date().toISOString(),
      summary: 'This is a test notification from AI Production Engineer.',
      url: `${this.env.WEB_URL}/w/${actor.workspaceId}/settings`,
      incident: {
        id: incidentId,
        workspaceId: actor.workspaceId,
        title: 'Test notification',
        severity: 'low',
        status: 'detected',
        serviceName: null,
        environment: null,
      },
    });
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: 'notification_channel.tested',
      resourceType: 'notification_channel',
      resourceId: id,
      outcome: result.ok ? 'success' : 'failure',
      correlationId: actor.correlationId,
      metadata: { status: result.status, error: result.error },
    });
    return { ok: result.ok, status: result.status, error: result.error };
  }

  async deliveries(actor: ActorContext, limit = 50): Promise<NotificationDelivery[]> {
    const rows = await this.db
      .select({ d: notificationDeliveries, channelName: notificationChannels.name })
      .from(notificationDeliveries)
      .innerJoin(
        notificationChannels,
        eq(notificationChannels.id, notificationDeliveries.channelId),
      )
      .where(eq(notificationDeliveries.workspaceId, actor.workspaceId))
      .orderBy(desc(notificationDeliveries.updatedAt))
      .limit(limit);
    return rows.map(({ d, channelName }) => ({
      id: d.id,
      channelId: d.channelId,
      channelName,
      eventType: d.eventType,
      incidentId: d.incidentId,
      status: d.status as NotificationDelivery['status'],
      attempts: d.attempts,
      responseStatus: d.responseStatus,
      error: d.error,
      createdAt: d.createdAt.toISOString(),
      sentAt: d.sentAt?.toISOString() ?? null,
    }));
  }
}
