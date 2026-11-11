import { and, eq, sql } from 'drizzle-orm';
import type { Tx } from '../../../core/db/client';
import { errorGroups, errorOccurrences } from '../../../core/db/schema';
import type { NormalizedEvent } from './normalize';

type ErrorEvent = Extract<NormalizedEvent, { kind: 'error' }>;

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

export async function recordErrorOccurrence(
  tx: Tx,
  workspaceId: string,
  externalEventId: string,
  event: ErrorEvent,
): Promise<{ groupId: string; ignored: boolean; fresh: boolean }> {
  const stack = Array.isArray(event.attributes.stack)
    ? (event.attributes.stack as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
  const release = str(event.attributes.release);
  const route = str(event.attributes.httpRoute);
  const at = event.occurredAt;

  const [group] = await tx
    .insert(errorGroups)
    .values({
      workspaceId,
      fingerprint: event.fingerprint,
      title: event.title,
      errorType: event.errorType,
      message: event.message.slice(0, 2000),
      service: event.serviceName,
      environment: event.environment,
      count: 0,
      firstSeenAt: at,
      lastSeenAt: at,
      release,
      firstRelease: release,
      route,
      stack,
    })
    .onConflictDoUpdate({
      target: [errorGroups.workspaceId, errorGroups.fingerprint],
      set: { workspaceId: sql`${errorGroups.workspaceId}` },
    })
    .returning();

  const inserted = await tx
    .insert(errorOccurrences)
    .values({
      workspaceId,
      groupId: group!.id,
      occurredAt: at,
      traceId: event.traceId,
      release,
      message: event.message.slice(0, 500),
      externalEventId,
    })
    .onConflictDoNothing()
    .returning({ id: errorOccurrences.id });
  const fresh = inserted.length > 0;
  if (!fresh) return { groupId: group!.id, ignored: group!.status === 'ignored', fresh };

  const reopen = group!.status === 'resolved';
  await tx
    .update(errorGroups)
    .set({
      count: sql`${errorGroups.count} + 1`,
      lastSeenAt: sql`greatest(${errorGroups.lastSeenAt}, ${at.toISOString()}::timestamptz)`,
      firstSeenAt: sql`least(${errorGroups.firstSeenAt}, ${at.toISOString()}::timestamptz)`,
      ...(at >= group!.lastSeenAt
        ? { stack: stack.length ? stack : group!.stack, release: release ?? group!.release }
        : {}),
      ...(reopen ? { status: 'unresolved', reopenedAt: at } : {}),
    })
    .where(and(eq(errorGroups.id, group!.id)));
  return { groupId: group!.id, ignored: group!.status === 'ignored', fresh };
}
