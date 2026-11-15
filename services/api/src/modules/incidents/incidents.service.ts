import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ne, type SQL } from 'drizzle-orm';
import {
  type ApprovalPolicyInput,
  type CreateIncidentInput,
  type Incident,
  type SeverityRule,
  type TimelineEntry,
  type TransitionIncidentInput,
} from '@ape/api-contracts';
import { AuditService } from '../../core/audit/audit.service';
import { ApiException, conflict, isUniqueViolation, notFound } from '../../core/common/errors';
import type { ActorContext } from '../../core/common/request-context';
import { DB } from '../../core/db/database.module';
import type { Database, Tx } from '../../core/db/client';
import { ENV, type ApiEnv } from '../../core/config/config.module';
import {
  incidentEvents,
  incidents,
  integrations,
  outbox,
  services,
  DEFAULT_APPROVAL_POLICY,
  users,
  workspaces,
} from '../../core/db/schema';
import { IncidentReader, type IncidentRow } from './application/incident-reader';
import { canTransition } from './domain/lifecycle';
import { incidentDeploys } from './infrastructure/deploys';
import { startPolicyRun } from './infrastructure/escalation-hook';
import { notifyWholeTeam } from './infrastructure/team-notify';

@Injectable()
export class IncidentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly audit: AuditService,
    private readonly reader: IncidentReader,
  ) {}

  async timeline(actor: ActorContext, id: string): Promise<TimelineEntry[]> {
    const incident = await this.reader.get(actor.workspaceId, id);
    const read = (kind: SQL, limit: number) =>
      this.db
        .select({ e: incidentEvents, actorEmail: users.email })
        .from(incidentEvents)
        .leftJoin(users, eq(users.id, incidentEvents.actorId))
        .where(
          and(
            eq(incidentEvents.incidentId, id),
            eq(incidentEvents.workspaceId, actor.workspaceId),
            kind,
          ),
        )
        .orderBy(desc(incidentEvents.occurredAt))
        .limit(limit);
    const [steps, errors, deploys] = await Promise.all([
      read(ne(incidentEvents.kind, 'error'), 500),
      read(eq(incidentEvents.kind, 'error'), 200),
      incidentDeploys(this.db, actor.workspaceId, incident),
    ]);
    const entries: TimelineEntry[] = [
      ...[...steps, ...errors].map(({ e, actorEmail }) => ({
        kind: e.kind as 'error' | 'created' | 'status_change',
        id: e.id,
        at: e.occurredAt.toISOString(),
        source: e.source,
        summary: e.summary,
        traceId: e.traceId,
        sourceUrl: e.sourceUrl,
        actorEmail,
        attributes: e.attributes,
      })),
      ...deploys,
    ];
    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }

  async create(actor: ActorContext, input: CreateIncidentInput): Promise<Incident> {
    const service = input.serviceId ? await this.findService(actor, input.serviceId) : undefined;
    const monitor = input.monitorId ? await this.findMonitor(actor, input.monitorId) : undefined;
    const now = new Date();
    const id = await this.db.transaction(async (tx) => {
      const [r] = await tx
        .insert(incidents)
        .values({
          workspaceId: actor.workspaceId,
          serviceId: service?.id ?? null,
          serviceName: service?.name ?? null,
          environment: service?.environment ?? null,
          monitorId: monitor?.id ?? null,
          title: input.title,
          description: input.description ?? null,
          severity: input.severity ?? 'medium',
          source: 'manual',
          fingerprint: `manual:${randomUUID()}`,
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .returning();
      const row = r!;
      await tx.insert(incidentEvents).values({
        workspaceId: actor.workspaceId,
        incidentId: row.id,
        kind: 'created',
        source: 'manual',
        occurredAt: now,
        actorId: actor.userId,
        summary: 'Incident reported manually',
        attributes: { notify: input.notify ?? 'none' },
      });
      await tx.insert(outbox).values({
        workspaceId: actor.workspaceId,
        topic: 'incident.detected',
        payload: { incidentId: row.id, workspaceId: actor.workspaceId },
      });
      await this.notify(tx, actor, input, row);
      await this.audit.record(
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: 'incident.created',
          resourceType: 'incident',
          resourceId: row.id,
          outcome: 'success',
          correlationId: actor.correlationId,
          metadata: { source: 'manual', severity: row.severity, notify: input.notify ?? 'none' },
        },
        tx,
      );
      return row.id;
    });
    return this.reader.get(actor.workspaceId, id);
  }

  private async notify(tx: Tx, actor: ActorContext, input: CreateIncidentInput, row: IncidentRow) {
    if (input.notify === 'policy' && input.policyId)
      await startPolicyRun(tx, actor.workspaceId, row.id, input.policyId);
    if (input.notify === 'team') await notifyWholeTeam(tx, row, this.env.WEB_URL);
  }

  private async findService(actor: ActorContext, id: string) {
    const [service] = await this.db
      .select()
      .from(services)
      .where(and(eq(services.id, id), eq(services.workspaceId, actor.workspaceId)));
    if (!service) throw notFound('Service');
    return service;
  }

  private async findMonitor(actor: ActorContext, id: string) {
    const [monitor] = await this.db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.workspaceId, actor.workspaceId)));
    if (!monitor) throw notFound('Monitor');
    return monitor;
  }

  async transition(
    actor: ActorContext,
    id: string,
    input: TransitionIncidentInput,
  ): Promise<Incident> {
    try {
      await this.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(incidents)
          .where(and(eq(incidents.id, id), eq(incidents.workspaceId, actor.workspaceId)))
          .for('update');
        if (!current) throw notFound('Incident');
        if (current.version !== input.expectedVersion) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'stale_version',
            'This incident changed since you loaded it. Refresh and try again.',
          );
        }
        if (!canTransition(current.status, input.to)) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'invalid_transition',
            `Cannot move an incident from ${current.status} to ${input.to}`,
          );
        }
        await tx
          .update(incidents)
          .set({ status: input.to, version: current.version + 1 })
          .where(and(eq(incidents.id, id), eq(incidents.workspaceId, actor.workspaceId)));
        await tx.insert(incidentEvents).values({
          workspaceId: actor.workspaceId,
          incidentId: id,
          kind: 'status_change',
          source: 'user',
          occurredAt: new Date(),
          actorId: actor.userId,
          summary: `Status changed from ${current.status} to ${input.to}`,
          attributes: { from: current.status, to: input.to, reason: input.reason ?? null },
        });
        await this.audit.record(
          {
            workspaceId: actor.workspaceId,
            actorId: actor.userId,
            action: 'incident.status_changed',
            resourceType: 'incident',
            resourceId: id,
            outcome: 'success',
            correlationId: actor.correlationId,
            metadata: { from: current.status, to: input.to, reason: input.reason ?? null },
          },
          tx,
        );
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw conflict('A newer open incident already tracks this error; reopen that one instead');
      }
      throw err;
    }
    return this.reader.get(actor.workspaceId, id);
  }

  async severityRules(actor: ActorContext): Promise<SeverityRule[]> {
    const [ws] = await this.db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, actor.workspaceId));
    return ws?.settings.severityRules ?? [];
  }

  async setSeverityRules(actor: ActorContext, rules: SeverityRule[]): Promise<SeverityRule[]> {
    const before = await this.severityRules(actor);
    const [ws] = await this.db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, actor.workspaceId));
    await this.db
      .update(workspaces)
      .set({ settings: { ...ws!.settings, severityRules: rules } })
      .where(eq(workspaces.id, actor.workspaceId));
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: 'settings.severity_rules_changed',
      resourceType: 'workspace',
      resourceId: actor.workspaceId,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: { before, after: rules },
    });
    return rules;
  }

  async approvalPolicy(actor: ActorContext): Promise<ApprovalPolicyInput> {
    const [ws] = await this.db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, actor.workspaceId));
    return (ws?.settings.approvalPolicy ?? DEFAULT_APPROVAL_POLICY) as ApprovalPolicyInput;
  }

  async setApprovalPolicy(
    actor: ActorContext,
    policy: ApprovalPolicyInput,
  ): Promise<ApprovalPolicyInput> {
    const before = await this.approvalPolicy(actor);
    await this.db.transaction(async (tx) => {
      const [ws] = await tx
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, actor.workspaceId))
        .for('update');
      await tx
        .update(workspaces)
        .set({ settings: { ...ws!.settings, approvalPolicy: policy } })
        .where(eq(workspaces.id, actor.workspaceId));
      await this.audit.record(
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: 'settings.approval_policy_changed',
          resourceType: 'workspace',
          resourceId: actor.workspaceId,
          outcome: 'success',
          correlationId: actor.correlationId,
          metadata: { before, after: policy },
        },
        tx,
      );
    });
    return policy;
  }
}
