import { and, eq } from 'drizzle-orm';
import type { ActivityEntry } from '@ape/api-contracts';
import type { Database } from '../../../core/db/client';
import {
  deliveryAttempts,
  escalationNotifications,
  escalationRuns,
  notificationChannels,
  notificationDeliveries,
  users,
} from '../../../core/db/schema';
import { activityEntry } from '../domain/activity';
import { maskAddress } from '../domain/mask';

const CAP = 300;

type AttemptRow = typeof deliveryAttempts.$inferSelect;
type EscalatedRow = { n: typeof escalationNotifications.$inferSelect; name: string | null };
type DeliveredRow = { d: typeof notificationDeliveries.$inferSelect; kind: string; name: string };

const fromAttempt = (a: AttemptRow) =>
  activityEntry({
    id: `att-${a.id}`,
    kind: 'notification',
    at: a.sentAt ?? a.createdAt,
    source: a.runId ? 'escalation' : 'notifications',
    summary: `${a.channel} to ${a.recipientName ?? maskAddress(a.channel, a.address)}${a.stepIndex !== null ? ` (escalation step ${a.stepIndex + 1})` : ''}`,
    channel: a.channel,
    address: maskAddress(a.channel, a.address),
    deliveryStatus: a.state,
    statusCode: a.responseStatus,
    attributes: {
      attempts: a.attempts,
      ...(a.deliveredAt ? { deliveredAt: a.deliveredAt.toISOString() } : {}),
      ...(a.error ? { error: a.error } : {}),
      ...(a.providerMessageId ? { providerMessageId: a.providerMessageId } : {}),
    },
  });

const fromEscalation = ({ n, name }: EscalatedRow) =>
  activityEntry({
    id: `esc-${n.id}`,
    kind: 'notification',
    at: n.sentAt,
    source: 'escalation',
    summary: `E-mail to ${name ?? maskAddress('email', n.email)} (escalation step ${n.stepIndex + 1})`,
    channel: 'email',
    address: maskAddress('email', n.email),
    deliveryStatus: n.status,
    attributes: n.error ? { error: n.error } : {},
  });

const fromDelivery = ({ d, kind, name }: DeliveredRow) =>
  activityEntry({
    id: `dlv-${d.id}`,
    kind: 'notification',
    at: d.sentAt ?? d.createdAt,
    source: 'notifications',
    summary: `${kind} notification to ${name} (${d.eventType})`,
    channel: kind,
    address: name,
    deliveryStatus: d.status,
    statusCode: d.responseStatus,
    attributes: { attempts: d.attempts, ...(d.error ? { error: d.error } : {}) },
  });

export async function notificationAttempts(
  db: Database,
  workspaceId: string,
  incidentId: string,
): Promise<ActivityEntry[]> {
  const [attempts, escalated, delivered] = await Promise.all([
    db
      .select()
      .from(deliveryAttempts)
      .where(
        and(
          eq(deliveryAttempts.workspaceId, workspaceId),
          eq(deliveryAttempts.incidentId, incidentId),
        ),
      )
      .limit(CAP),
    db
      .select({ n: escalationNotifications, name: users.name })
      .from(escalationNotifications)
      .innerJoin(escalationRuns, eq(escalationRuns.id, escalationNotifications.runId))
      .leftJoin(users, eq(users.id, escalationNotifications.userId))
      .where(
        and(
          eq(escalationNotifications.workspaceId, workspaceId),
          eq(escalationRuns.incidentId, incidentId),
        ),
      )
      .limit(CAP),
    db
      .select({
        d: notificationDeliveries,
        kind: notificationChannels.kind,
        name: notificationChannels.name,
      })
      .from(notificationDeliveries)
      .innerJoin(
        notificationChannels,
        eq(notificationChannels.id, notificationDeliveries.channelId),
      )
      .where(
        and(
          eq(notificationDeliveries.workspaceId, workspaceId),
          eq(notificationDeliveries.incidentId, incidentId),
        ),
      )
      .limit(CAP),
  ]);
  return [
    ...attempts.map(fromAttempt),
    ...escalated.map(fromEscalation),
    ...delivered.map(fromDelivery),
  ];
}
