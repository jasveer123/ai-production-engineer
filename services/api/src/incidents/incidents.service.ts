import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lt, lte, ne, notInArray, inArray, type SQL } from 'drizzle-orm';
import {
  CLOSED_STATUSES,
  type ApprovalPolicyInput,
  type CreateIncidentInput,
  type Incident,
  type IncidentListQuery,
  type SeverityRule,
  type TimelineEntry,
  type TransitionIncidentInput,
} from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ApiException, conflict, isUniqueViolation, notFound } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import {
  deployments,
  incidentEvents,
  incidents,
  outbox,
  services,
  DEFAULT_APPROVAL_POLICY,
  users,
  workspaces,
} from '../db/schema';
import { canTransition } from './lifecycle';

const DEPLOY_LOOKBACK_MS = 24 * 60 * 60_000;

type IncidentRow = typeof incidents.$inferSelect;

const toDto = (r: IncidentRow, repositoryFullName: string | null): Incident => ({
  id: r.id,
  title: r.title,
  description: r.description,
  status: r.status,
  severity: r.severity,
  source: r.source,
  serviceId: r.serviceId,
  serviceName: r.serviceName,
  environment: r.environment,
  repositoryFullName,
  fingerprint: r.fingerprint,
  eventCount: r.eventCount,
  firstSeenAt: r.firstSeenAt.toISOString(),
  lastSeenAt: r.lastSeenAt.toISOString(),
  version: r.version,
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class IncidentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(actor: ActorContext, q: IncidentListQuery & { limit: number }): Promise<Incident[]> {
    const f: SQL[] = [eq(incidents.workspaceId, actor.workspaceId)];
    if (q.status === 'open') f.push(notInArray(incidents.status, [...CLOSED_STATUSES]));
    else if (q.status === 'closed') f.push(inArray(incidents.status, [...CLOSED_STATUSES]));
    else if (q.status) f.push(eq(incidents.status, q.status));
    if (q.severity) f.push(eq(incidents.severity, q.severity));
    if (q.serviceId) f.push(eq(incidents.serviceId, q.serviceId));
    if (q.environment) f.push(eq(incidents.environment, q.environment));
    if (q.before) f.push(lt(incidents.lastSeenAt, new Date(q.before)));

    const rows = await this.db
      .select({ incident: incidents, repo: services.repositoryFullName })
      .from(incidents)
      .leftJoin(services, eq(services.id, incidents.serviceId))
      .where(and(...f))
      .orderBy(desc(incidents.lastSeenAt))
      .limit(q.limit);
    return rows.map((r) => toDto(r.incident, r.repo));
  }

  async get(actor: ActorContext, id: string): Promise<Incident> {
    const [row] = await this.db
      .select({ incident: incidents, repo: services.repositoryFullName })
      .from(incidents)
      .leftJoin(services, eq(services.id, incidents.serviceId))
      .where(and(eq(incidents.id, id), eq(incidents.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Incident');
    return toDto(row.incident, row.repo);
  }

  /** Incident events plus deploys of the same service around the incident, newest first. */
  async timeline(actor: ActorContext, id: string): Promise<TimelineEntry[]> {
    const incident = await this.get(actor, id);
    // Repeated errors are capped to the newest 200; every other step (opened, status changes, AI,
    // fix, recovery) is always returned so a busy incident never loses its history (FR-05).
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
    const [steps, errors] = await Promise.all([
      read(ne(incidentEvents.kind, 'error'), 500),
      read(eq(incidentEvents.kind, 'error'), 200),
    ]);
    const events = [...steps, ...errors];

    const deploys =
      incident.serviceName && incident.environment
        ? await this.db
            .select()
            .from(deployments)
            .where(
              and(
                eq(deployments.workspaceId, actor.workspaceId),
                eq(deployments.serviceName, incident.serviceName),
                eq(deployments.environment, incident.environment),
                gte(
                  deployments.deployedAt,
                  new Date(Date.parse(incident.firstSeenAt) - DEPLOY_LOOKBACK_MS),
                ),
                lte(
                  deployments.deployedAt,
                  new Date(Math.max(Date.parse(incident.lastSeenAt), Date.now())),
                ),
              ),
            )
            .orderBy(desc(deployments.deployedAt))
            .limit(20)
        : [];

    const entries: TimelineEntry[] = [
      ...events.map(({ e, actorEmail }) => ({
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
      ...deploys.map((d) => ({
        kind: 'deploy' as const,
        id: d.id,
        at: d.deployedAt.toISOString(),
        source: 'deploy_webhook',
        summary: `Deployed ${d.serviceName}${d.version ? ` ${d.version}` : ''} to ${d.environment}`,
        commitSha: d.commitSha,
        version: d.version,
        environment: d.environment,
      })),
    ];
    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }

  async create(actor: ActorContext, input: CreateIncidentInput): Promise<Incident> {
    let service: typeof services.$inferSelect | undefined;
    if (input.serviceId) {
      [service] = await this.db
        .select()
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.workspaceId, actor.workspaceId)));
      if (!service) throw notFound('Service');
    }
    const now = new Date();
    const row = await this.db.transaction(async (tx) => {
      const [r] = await tx
        .insert(incidents)
        .values({
          workspaceId: actor.workspaceId,
          serviceId: service?.id ?? null,
          serviceName: service?.name ?? null,
          environment: service?.environment ?? null,
          title: input.title,
          description: input.description ?? null,
          severity: input.severity ?? 'medium',
          source: 'manual',
          fingerprint: `manual:${randomUUID()}`,
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .returning();
      await tx.insert(incidentEvents).values({
        workspaceId: actor.workspaceId,
        incidentId: r!.id,
        kind: 'created',
        source: 'manual',
        occurredAt: now,
        actorId: actor.userId,
        summary: 'Incident created manually',
      });
      await tx.insert(outbox).values({
        workspaceId: actor.workspaceId,
        topic: 'incident.detected',
        payload: { incidentId: r!.id, workspaceId: actor.workspaceId },
      });
      await this.audit.record(
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: 'incident.created',
          resourceType: 'incident',
          resourceId: r!.id,
          outcome: 'success',
          correlationId: actor.correlationId,
          metadata: { source: 'manual', severity: r!.severity },
        },
        tx,
      );
      return r!;
    });
    return toDto(row, service?.repositoryFullName ?? null);
  }

  /** Validated, versioned status change. History is kept as a timeline event. */
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
          .where(eq(incidents.id, id));
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
    return this.get(actor, id);
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

  /** The PR activity re-checks the current policy at write time (ADR-018), so this applies to
   * approvals already given too. */
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
