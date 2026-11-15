import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  CLOSED_STATUSES,
  type Incident,
  type IncidentListQuery,
  type PersonRef,
} from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import { incidents, services, users } from '../../../core/db/schema';
import { responseStateOf } from '../domain/response';

export type IncidentRow = typeof incidents.$inferSelect;
type ListQuery = IncidentListQuery & { limit: number; offset: number };

const ackUser = alias(users, 'ack_user');
const resolveUser = alias(users, 'resolve_user');
const assigneeUser = alias(users, 'assignee_user');

const closedList = sql.raw(CLOSED_STATUSES.map((s) => `'${s}'`).join(','));

export const responseStateSql = sql<string>`case
  when ${incidents.resolvedAt} is not null or ${incidents.status} in (${closedList}) then 'resolved'
  when ${incidents.acknowledgedAt} is not null then 'acknowledged'
  else 'open' end`;

// Incidents opened by an alert or monitor only know their source through the alerts table.
export const effectiveMonitorSql = sql<string | null>`coalesce(${incidents.monitorId},
  (select a.source_id from alerts a where a.incident_id = ${incidents.id}
   order by a.first_fired_at limit 1))`;

// Rows closed by the AI pipeline (or before resolved_at existed) take their time from the event.
export const closedAtSql = sql<string | null>`(select max(e.occurred_at) from incident_events e
  where e.incident_id = ${incidents.id} and e.kind = 'status_change'
  and e.attributes->>'to' in (${closedList}))`;

type Joined = { id: string | null; name: string | null; email: string | null } | null;

const person = (p: Joined) =>
  p?.id && p.email ? ({ id: p.id, name: p.name, email: p.email } satisfies PersonRef) : null;

const selection = {
  incident: incidents,
  repo: services.repositoryFullName,
  monitorId: effectiveMonitorSql,
  closedAt: closedAtSql,
  ack: { id: ackUser.id, name: ackUser.name, email: ackUser.email },
  resolver: { id: resolveUser.id, name: resolveUser.name, email: resolveUser.email },
  assignee: { id: assigneeUser.id, name: assigneeUser.name, email: assigneeUser.email },
};

type Selected = {
  incident: IncidentRow;
  repo: string | null;
  monitorId: string | null;
  closedAt: string | Date | null;
  ack: Joined;
  resolver: Joined;
  assignee: Joined;
};

function toDto(s: Selected): Incident {
  const r = s.incident;
  const state = responseStateOf(r);
  const derivedAt =
    !r.resolvedAt && state === 'resolved' && s.closedAt ? new Date(s.closedAt) : null;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    severity: r.severity,
    source: r.source,
    serviceId: r.serviceId,
    serviceName: r.serviceName,
    environment: r.environment,
    repositoryFullName: s.repo,
    fingerprint: r.fingerprint,
    eventCount: r.eventCount,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
    version: r.version,
    acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    responseState: state,
    acknowledgedBy: person(s.ack),
    resolvedAt: (r.resolvedAt ?? derivedAt)?.toISOString() ?? null,
    resolvedBy: person(s.resolver),
    resolutionOrigin: r.resolutionOrigin ?? (state === 'resolved' ? 'automatic' : null),
    resolutionReason: r.resolutionReason,
    assignee: person(s.assignee),
    monitorId: s.monitorId,
    metadata: r.metadata ?? null,
    postMortem: r.postMortem,
    postMortemUpdatedAt: r.postMortemUpdatedAt?.toISOString() ?? null,
  };
}

function listFilters(workspaceId: string, q: ListQuery): SQL[] {
  const f: SQL[] = [eq(incidents.workspaceId, workspaceId)];
  if (q.status === 'open') f.push(notInArray(incidents.status, [...CLOSED_STATUSES]));
  else if (q.status === 'closed') f.push(inArray(incidents.status, [...CLOSED_STATUSES]));
  else if (q.status) f.push(eq(incidents.status, q.status));
  if (q.state === 'unresolved') f.push(sql`${responseStateSql} <> 'resolved'`);
  else if (q.state) f.push(sql`${responseStateSql} = ${q.state}`);
  if (q.severity) f.push(eq(incidents.severity, q.severity));
  if (q.serviceId) f.push(eq(incidents.serviceId, q.serviceId));
  if (q.environment) f.push(eq(incidents.environment, q.environment));
  if (q.monitorId) f.push(sql`${effectiveMonitorSql} = ${q.monitorId}`);
  if (q.source) f.push(eq(incidents.source, q.source));
  if (q.from) f.push(gte(incidents.firstSeenAt, new Date(q.from)));
  if (q.to) f.push(lte(incidents.firstSeenAt, new Date(q.to)));
  if (q.before) f.push(lt(incidents.lastSeenAt, new Date(q.before)));
  if (q.q) {
    const term = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    f.push(or(ilike(incidents.title, term), ilike(incidents.description, term))!);
  }
  return f;
}

@Injectable()
export class IncidentReader {
  constructor(@Inject(DB) private readonly db: Database) {}

  private base(db: Database | Tx = this.db) {
    return db
      .select(selection)
      .from(incidents)
      .leftJoin(services, eq(services.id, incidents.serviceId))
      .leftJoin(ackUser, eq(ackUser.id, incidents.acknowledgedBy))
      .leftJoin(resolveUser, eq(resolveUser.id, incidents.resolvedBy))
      .leftJoin(assigneeUser, eq(assigneeUser.id, incidents.assigneeId));
  }

  async list(workspaceId: string, q: ListQuery): Promise<Incident[]> {
    const rows = await this.base()
      .where(and(...listFilters(workspaceId, q)))
      .orderBy(desc(incidents.lastSeenAt), desc(incidents.id))
      .limit(q.limit)
      .offset(q.offset);
    return rows.map(toDto);
  }

  async get(workspaceId: string, id: string, db: Database | Tx = this.db): Promise<Incident> {
    const [row] = await this.base(db).where(
      and(eq(incidents.id, id), eq(incidents.workspaceId, workspaceId)),
    );
    if (!row) throw notFound('Incident');
    return toDto(row);
  }
}
