import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type {
  ActivityKind,
  EscalateIncidentInput,
  Incident,
  ResponseActionInput,
  UpdateIncidentInput,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { ApiException, conflict, isUniqueViolation, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import { incidentEvents, incidents, workspaceMembers } from '../../../core/db/schema';
import { planResponse, type ResponseAction } from '../domain/response';
import { escalateNow, stopRuns } from '../infrastructure/escalation-hook';
import { IncidentReader, type IncidentRow } from './incident-reader';

type Patch = Partial<typeof incidents.$inferInsert>;

const PAST: Record<ResponseAction, ActivityKind> = {
  acknowledge: 'acknowledged',
  unacknowledge: 'unacknowledged',
  resolve: 'resolved',
  reopen: 'reopened',
};

const SUMMARY: Record<ResponseAction, string> = {
  acknowledge: 'Acknowledged',
  unacknowledge: 'Acknowledgement removed',
  resolve: 'Resolved',
  reopen: 'Reopened',
};

export interface EventInput {
  kind: ActivityKind | 'status_change';
  summary: string;
  attributes?: Record<string, unknown>;
}

@Injectable()
export class IncidentResponseService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly reader: IncidentReader,
    private readonly audit: AuditService,
  ) {}

  async locked<T>(
    actor: ActorContext,
    id: string,
    expectedVersion: number | undefined,
    work: (tx: Tx, row: IncidentRow) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(incidents)
          .where(and(eq(incidents.id, id), eq(incidents.workspaceId, actor.workspaceId)))
          .for('update');
        if (!row) throw notFound('Incident');
        if (expectedVersion !== undefined && row.version !== expectedVersion)
          throw new ApiException(
            HttpStatus.CONFLICT,
            'stale_version',
            'This incident changed since you loaded it. Refresh and try again.',
          );
        return work(tx, row);
      });
    } catch (err) {
      if (isUniqueViolation(err))
        throw conflict(
          'A newer open incident already tracks this problem; work on that one instead',
        );
      throw err;
    }
  }

  async write(tx: Tx, actor: ActorContext, row: IncidentRow, patch: Patch, event: EventInput) {
    await tx
      .update(incidents)
      .set({ ...patch, version: row.version + 1 })
      .where(and(eq(incidents.id, row.id), eq(incidents.workspaceId, actor.workspaceId)));
    const [saved] = await tx
      .insert(incidentEvents)
      .values({
        workspaceId: actor.workspaceId,
        incidentId: row.id,
        kind: event.kind,
        source: 'user',
        occurredAt: new Date(),
        actorId: actor.userId,
        summary: event.summary,
        attributes: event.attributes ?? {},
      })
      .returning({ id: incidentEvents.id });
    await this.audit.record(
      {
        workspaceId: actor.workspaceId,
        actorId: actor.userId,
        action: `incident.${event.kind}`,
        resourceType: 'incident',
        resourceId: row.id,
        outcome: 'success',
        correlationId: actor.correlationId,
        metadata: event.attributes ?? {},
      },
      tx,
    );
    return saved!.id;
  }

  async respond(
    actor: ActorContext,
    id: string,
    action: ResponseAction,
    input: ResponseActionInput,
  ): Promise<Incident> {
    await this.locked(actor, id, input.expectedVersion, async (tx, row) => {
      const plan = planResponse(row, action);
      if (!plan.ok) throw new ApiException(HttpStatus.CONFLICT, plan.code, plan.message);
      const now = new Date();
      const patch: Patch = {
        acknowledge: { acknowledgedAt: now, acknowledgedBy: actor.userId },
        unacknowledge: { acknowledgedAt: null, acknowledgedBy: null },
        resolve: {
          resolvedAt: now,
          resolvedBy: actor.userId,
          resolutionOrigin: 'manual' as const,
          resolutionReason: input.reason ?? null,
        },
        reopen: {
          resolvedAt: null,
          resolvedBy: null,
          resolutionOrigin: null,
          resolutionReason: null,
          acknowledgedAt: null,
          acknowledgedBy: null,
        },
      }[action];
      if (plan.aiStatus) patch.status = plan.aiStatus;
      const attributes = {
        reason: input.reason ?? null,
        ...(plan.aiStatus ? { from: row.status, to: plan.aiStatus } : {}),
      };
      await this.write(tx, actor, row, patch, {
        kind: PAST[action],
        summary: input.reason ? `${SUMMARY[action]}: ${input.reason}` : SUMMARY[action],
        attributes,
      });
      if (action === 'acknowledge') await stopRuns(tx, actor.workspaceId, id, 'acknowledged');
      if (action === 'resolve') await stopRuns(tx, actor.workspaceId, id, 'cancelled');
    });
    return this.reader.get(actor.workspaceId, id);
  }

  async escalate(actor: ActorContext, id: string, input: EscalateIncidentInput): Promise<Incident> {
    await this.locked(actor, id, undefined, async (tx, row) => {
      if (row.resolvedAt || row.acknowledgedAt)
        throw new ApiException(
          HttpStatus.CONFLICT,
          'not_open',
          'Only an open, unacknowledged incident can be escalated. Unacknowledge it first.',
        );
      const runs = await escalateNow(tx, actor.workspaceId, id, input.policyId);
      if (runs === 0)
        throw new ApiException(
          HttpStatus.CONFLICT,
          'no_escalation',
          'No escalation is running for this incident. Choose a policy to escalate with.',
        );
      await this.write(
        tx,
        actor,
        row,
        {},
        {
          kind: 'escalated',
          summary: 'Escalated to the next step now',
          attributes: { policyId: input.policyId ?? null },
        },
      );
    });
    return this.reader.get(actor.workspaceId, id);
  }

  async update(actor: ActorContext, id: string, input: UpdateIncidentInput): Promise<Incident> {
    await this.locked(actor, id, input.expectedVersion, async (tx, row) => {
      if (input.assigneeId) await this.requireMember(tx, actor.workspaceId, input.assigneeId);
      const patch: Patch = {};
      const changes: string[] = [];
      if (input.title !== undefined && input.title !== row.title) {
        patch.title = input.title;
        changes.push(`renamed to "${input.title}"`);
      }
      if (input.description !== undefined) {
        patch.description = input.description;
        changes.push('cause updated');
      }
      if (input.severity && input.severity !== row.severity) {
        patch.severity = input.severity;
        changes.push(`severity ${row.severity} → ${input.severity}`);
      }
      if (input.assigneeId !== undefined && input.assigneeId !== row.assigneeId) {
        patch.assigneeId = input.assigneeId;
        changes.push(input.assigneeId ? 'assignee changed' : 'assignee removed');
      }
      if (changes.length === 0) return;
      await this.write(tx, actor, row, patch, {
        kind: 'updated',
        summary: changes.join(', ').replace(/^./, (c) => c.toUpperCase()),
        attributes: { before: { title: row.title, severity: row.severity }, ...input },
      });
    });
    return this.reader.get(actor.workspaceId, id);
  }

  private async requireMember(tx: Tx, workspaceId: string, userId: string) {
    const [m] = await tx
      .select({ id: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
      );
    if (!m) throw notFound('Workspace member');
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    await this.locked(actor, id, undefined, async (tx, row) => {
      await tx
        .delete(incidents)
        .where(and(eq(incidents.id, id), eq(incidents.workspaceId, actor.workspaceId)));
      await this.audit.record(
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: 'incident.deleted',
          resourceType: 'incident',
          resourceId: id,
          outcome: 'success',
          correlationId: actor.correlationId,
          metadata: { title: row.title, source: row.source },
        },
        tx,
      );
    });
  }
}
