import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, type SQL } from 'drizzle-orm';
import type { AuditEvent, AuditQuery } from '@ape/api-contracts';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { auditEvents, users } from '../db/schema';

export interface AuditEntry {
  workspaceId?: string | null;
  actorId?: string | null;
  actorType?: 'user' | 'agent' | 'system';
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: 'success' | 'denied' | 'failure';
  correlationId: string;
  metadata?: Record<string, unknown>;
}

type Executor = Pick<Database, 'insert'>;

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(entry: AuditEntry, executor: Executor = this.db): Promise<void> {
    await executor.insert(auditEvents).values({
      workspaceId: entry.workspaceId ?? null,
      actorId: entry.actorId ?? null,
      actorType: entry.actorType ?? 'user',
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      outcome: entry.outcome,
      correlationId: entry.correlationId,
      metadata: entry.metadata ?? {},
    });
  }

  async list(workspaceId: string, q: AuditQuery & { limit: number }): Promise<AuditEvent[]> {
    const filters: SQL[] = [eq(auditEvents.workspaceId, workspaceId)];
    if (q.action) filters.push(eq(auditEvents.action, q.action));
    if (q.resourceType) filters.push(eq(auditEvents.resourceType, q.resourceType));
    if (q.actorId) filters.push(eq(auditEvents.actorId, q.actorId));
    if (q.outcome) filters.push(eq(auditEvents.outcome, q.outcome));
    if (q.before) filters.push(lt(auditEvents.occurredAt, new Date(q.before)));

    const rows = await this.db
      .select({ event: auditEvents, actorEmail: users.email })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorId))
      .where(and(...filters))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(q.limit);

    return rows.map(({ event, actorEmail }) => ({
      id: event.id,
      actorId: event.actorId,
      actorEmail,
      actorType: event.actorType,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      outcome: event.outcome,
      correlationId: event.correlationId,
      metadata: event.metadata,
      occurredAt: event.occurredAt.toISOString(),
    }));
  }
}
