import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, ne, sql, type SQL } from 'drizzle-orm';
import type {
  ActivityEntry,
  ActivityKind,
  ActivityPage,
  CapturedResponse,
  Incident,
  IncidentContext,
} from '@ape/api-contracts';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  alerts,
  incidentEvents,
  integrations,
  monitorChecks,
  users,
} from '../../../core/db/schema';
import { activityEntry, pageActivity } from '../domain/activity';
import { buildCurlCommand, pairsOf, plainText } from '../domain/replay';
import { notificationAttempts } from '../infrastructure/delivery-reader';
import { incidentDeploys } from '../infrastructure/deploys';
import { incidentEscalations } from '../infrastructure/escalation-hook';
import { IncidentReader } from './incident-reader';

const CHECK_LOOKBACK_MS = 15 * 60_000;
const BODY_PREVIEW = 2048;

const KIND_MAP: Record<string, ActivityKind> = {
  created: 'incident_started',
  investigation: 'ai',
  fix: 'ai',
  verification: 'ai',
};

const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const stringMap = (v: unknown): Record<string, string> => Object.fromEntries(pairsOf(v, 'key'));

// Captured response fields are written by the monitors module when available; read them loosely.
function captured(row: typeof monitorChecks.$inferSelect): CapturedResponse {
  const extra = row as unknown as Record<string, unknown>;
  const response = (extra.response ?? {}) as Record<string, unknown>;
  const headers = extra.responseHeaders ?? response.headers;
  const body = asString(extra.responseBody ?? response.body ?? response.bodyPreview);
  return {
    checkedAt: row.checkedAt.toISOString(),
    statusCode: row.statusCode,
    error: row.error,
    region: asString(extra.region),
    headers: headers ? stringMap(headers) : null,
    bodyPreview: body ? body.slice(0, BODY_PREVIEW) : null,
  };
}

@Injectable()
export class IncidentActivityService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly reader: IncidentReader,
  ) {}

  async page(actor: ActorContext, id: string, after: string | undefined, limit: number) {
    const incident = await this.reader.get(actor.workspaceId, id);
    const [events, checks, deliveries, deploys] = await Promise.all([
      this.events(actor, id),
      this.checkFailures(actor.workspaceId, incident),
      notificationAttempts(this.db, actor.workspaceId, id),
      incidentDeploys(this.db, actor.workspaceId, incident),
    ]);
    const entries: ActivityEntry[] = [
      ...events,
      ...checks,
      ...deliveries,
      ...deploys.map((d) =>
        activityEntry({
          id: d.id,
          kind: 'deploy',
          at: new Date(d.at),
          source: d.source,
          summary: d.summary,
        }),
      ),
    ];
    if (incident.postMortem && incident.postMortemUpdatedAt)
      entries.push(
        activityEntry({
          id: `postmortem-${incident.id}`,
          kind: 'post_mortem',
          at: new Date(incident.postMortemUpdatedAt),
          source: 'user',
          summary: 'Post-mortem',
          body: incident.postMortem,
        }),
      );
    return pageActivity(entries, after, limit) satisfies ActivityPage;
  }

  private async events(actor: ActorContext, id: string): Promise<ActivityEntry[]> {
    const read = (kind: SQL, limit: number) =>
      this.db
        .select({ e: incidentEvents, name: users.name, email: users.email })
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
    // shortcut: the newest 1000 steps and 200 errors are kept; page server-side past that volume
    const rows = [
      ...(await read(ne(incidentEvents.kind, 'error'), 1000)),
      ...(await read(eq(incidentEvents.kind, 'error'), 200)),
    ];
    return rows.map(({ e, name, email }) => {
      const kind = KIND_MAP[e.kind] ?? (e.kind as ActivityKind);
      return activityEntry({
        id: e.id,
        kind,
        at: e.occurredAt,
        source: e.source,
        summary: e.summary ?? '',
        actor: e.actorId && email ? { id: e.actorId, name, email } : null,
        editable: kind === 'comment' && e.actorId === actor.userId,
        body: kind === 'comment' ? e.summary : null,
        sourceUrl: e.sourceUrl,
        channel: asString(e.attributes.channel),
        address: asString(e.attributes.address),
        deliveryStatus: asString(e.attributes.deliveryStatus),
        attributes: e.attributes,
      });
    });
  }

  private async streakStart(workspaceId: string, incident: Incident): Promise<Date> {
    const started = new Date(incident.firstSeenAt);
    const lookback = new Date(started.getTime() - CHECK_LOOKBACK_MS);
    const [lastPass] = await this.db
      .select({ at: monitorChecks.checkedAt })
      .from(monitorChecks)
      .where(
        and(
          eq(monitorChecks.workspaceId, workspaceId),
          eq(monitorChecks.monitorId, incident.monitorId!),
          eq(monitorChecks.ok, true),
          gte(monitorChecks.checkedAt, lookback),
          lte(monitorChecks.checkedAt, started),
        ),
      )
      .orderBy(desc(monitorChecks.checkedAt))
      .limit(1);
    return lastPass ? new Date(lastPass.at.getTime() + 1) : lookback;
  }

  private async failedChecks(workspaceId: string, incident: Incident, limit: number) {
    const from = await this.streakStart(workspaceId, incident);
    const to = incident.resolvedAt ? new Date(incident.resolvedAt) : new Date();
    return this.db
      .select()
      .from(monitorChecks)
      .where(
        and(
          eq(monitorChecks.workspaceId, workspaceId),
          eq(monitorChecks.monitorId, incident.monitorId!),
          eq(monitorChecks.ok, false),
          gte(monitorChecks.checkedAt, from),
          lte(monitorChecks.checkedAt, to),
        ),
      )
      .orderBy(desc(monitorChecks.checkedAt))
      .limit(limit);
  }

  private async checkFailures(workspaceId: string, incident: Incident): Promise<ActivityEntry[]> {
    if (!incident.monitorId) return [];
    const rows = await this.failedChecks(workspaceId, incident, 200);
    return rows.map((r) => {
      const c = captured(r);
      return activityEntry({
        id: `check-${r.id}`,
        kind: 'check_failed',
        at: r.checkedAt,
        source: 'monitor',
        summary: `Check failed${c.region ? ` from ${c.region}` : ''}: ${r.error ?? `HTTP ${r.statusCode}`}`,
        region: c.region,
        statusCode: r.statusCode,
      });
    });
  }

  async context(actor: ActorContext, id: string): Promise<IncidentContext> {
    const incident = await this.reader.get(actor.workspaceId, id);
    const [escalations, labels] = await Promise.all([
      incidentEscalations(this.db, actor.workspaceId, id),
      this.alertLabels(actor.workspaceId, id),
    ]);
    const empty = { monitor: null, replayCommand: null, lastResponse: null };
    const monitorPart = incident.monitorId
      ? await this.monitorPart(actor.workspaceId, incident)
      : null;
    return {
      ...(monitorPart ?? empty),
      escalations,
      inheritedMetadata: { ...labels, ...(monitorPart?.metadata ?? {}) },
    };
  }

  private async alertLabels(workspaceId: string, incidentId: string) {
    const [first] = await this.db
      .select({ labels: alerts.labels })
      .from(alerts)
      .where(and(eq(alerts.workspaceId, workspaceId), eq(alerts.incidentId, incidentId)))
      .orderBy(asc(alerts.firstFiredAt))
      .limit(1);
    return first?.labels ?? {};
  }

  private async monitorPart(workspaceId: string, incident: Incident) {
    const [row] = await this.db
      .select({ id: integrations.id, name: integrations.name, config: integrations.config })
      .from(integrations)
      .where(
        and(
          eq(integrations.id, incident.monitorId!),
          eq(integrations.workspaceId, workspaceId),
          sql`${integrations.config}->>'kind' = 'monitor'`,
        ),
      );
    if (!row) return null;
    const c = row.config;
    const url = asString(c.url) ?? (c.host ? `${plainText(c.host)}:${plainText(c.port)}` : null);
    const method = (asString(c.method) ?? 'GET').toUpperCase();
    const [last] = await this.failedChecks(workspaceId, incident, 1);
    return {
      monitor: { id: row.id, name: row.name, kind: asString(c.monitorKind) ?? 'http', url, method },
      replayCommand: asString(c.url)
        ? buildCurlCommand({
            url: c.url as string,
            method,
            headers: c.headers,
            body: asString(c.body ?? c.requestBody),
            timeoutSeconds: typeof c.timeoutSeconds === 'number' ? c.timeoutSeconds : null,
            basicAuthUser: asString(c.basicAuthUser ?? c.basicAuthUsername),
            followRedirects: typeof c.followRedirects === 'boolean' ? c.followRedirects : null,
          })
        : null,
      lastResponse: last ? captured(last) : null,
      metadata: stringMap(c.metadata),
    };
  }
}
