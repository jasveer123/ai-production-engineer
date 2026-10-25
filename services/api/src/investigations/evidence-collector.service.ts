import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import {
  alerts,
  deployments,
  incidentEvents,
  incidents,
  logRecords,
  services,
  spans,
} from '../db/schema';
import { ToolsService } from '../tools/tools.service';
import { GitHubService } from '../github/github.service';
import { str, type JaegerTrace } from '../ingestion/jaeger';
import { JaegerPoller } from '../ingestion/jaeger.poller';
import { excerpt, mapToRepoPath, parseFrames } from './code-paths';
import { redact } from './redact';

/** Bounds keep the bundle small, cheap and well inside the model's input budget. */
const LIMITS = {
  errorEvents: 4,
  alerts: 5,
  traceSpans: 40,
  deploys: 3,
  codeFiles: 3,
  codeRadius: 30,
  commits: 6,
  logLines: 40,
  toolLines: 30,
  itemChars: 8000,
};

/** Attribute values as text: scalars as-is, anything else as JSON. */
const scalar = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    ? String(v)
    : JSON.stringify(v);

/** Logs are read from 15 minutes before the first error to 5 minutes after the last one. */
const LOG_WINDOW_BEFORE_MS = 15 * 60_000;
const LOG_WINDOW_AFTER_MS = 5 * 60_000;

export interface DraftEvidence {
  kind: 'error_event' | 'alert' | 'trace' | 'log' | 'deploy' | 'code' | 'commit';
  title: string;
  source: string;
  sourceReference: string;
  sourceUrl: string | null;
  content: string;
}

export type CoverageValue = string | number;

export interface CollectedEvidence {
  items: (DraftEvidence & { contentHash: string })[];
  coverage: Record<string, CoverageValue>;
  redactions: Record<string, number>;
}

const fmtSpan = (t: JaegerTrace) => {
  const start = Math.min(...t.spans.map((s) => s.startTime));
  return [...t.spans]
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, LIMITS.traceSpans)
    .map((s) => {
      const svc = t.processes[s.processID]?.serviceName ?? '?';
      const err = s.tags.find((x) => x.key === 'error')?.value === true ? ' ERROR' : '';
      const status = str(s.tags.find((x) => x.key === 'http.response.status_code')?.value, '');
      const exc = str(
        (s.logs ?? []).flatMap((l) => l.fields).find((f) => f.key === 'exception.message')?.value,
        '',
      );
      return `+${Math.round((s.startTime - start) / 1000)}ms ${svc} ${s.operationName} (${Math.round(
        (s.duration ?? 0) / 1000,
      )}ms)${status ? ` status=${status}` : ''}${err}${exc ? ` exception="${exc}"` : ''}`;
    })
    .join('\n');
};

/**
 * Gathers bounded, redacted evidence for an incident. Missing sources are reported in `coverage`
 * rather than papered over (FR-04: missing data is identified, never fabricated).
 */
@Injectable()
export class EvidenceCollector {
  private readonly logger = new Logger(EvidenceCollector.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly github: GitHubService,
    private readonly jaeger: JaegerPoller,
    private readonly tools: ToolsService,
  ) {}

  async collect(incidentId: string, workspaceId: string): Promise<CollectedEvidence> {
    const [incident] = await this.db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.workspaceId, workspaceId)));
    if (!incident) throw new Error(`Incident ${incidentId} not found`);
    const [service] = incident.serviceId
      ? await this.db.select().from(services).where(eq(services.id, incident.serviceId))
      : [];

    const drafts: DraftEvidence[] = [];
    const coverage: Record<string, CoverageValue> = {
      logs: 0,
      metrics: 'not_supported',
    };

    // 1. Error occurrences: the first one and the most recent ones.
    const errors = await this.db
      .select()
      .from(incidentEvents)
      .where(and(eq(incidentEvents.incidentId, incidentId), eq(incidentEvents.kind, 'error')))
      .orderBy(desc(incidentEvents.occurredAt))
      .limit(50);
    const [first] = await this.db
      .select()
      .from(incidentEvents)
      .where(and(eq(incidentEvents.incidentId, incidentId), eq(incidentEvents.kind, 'error')))
      .orderBy(asc(incidentEvents.occurredAt))
      .limit(1);
    const picked = [...errors.slice(0, LIMITS.errorEvents - 1), ...(first ? [first] : [])].filter(
      (e, i, a) => a.findIndex((x) => x.id === e.id) === i,
    );
    for (const e of picked) {
      const a = e.attributes as {
        stack?: string[];
        httpRoute?: string;
        httpStatus?: number;
        operation?: string;
      };
      drafts.push({
        kind: 'error_event',
        title: `${e === first ? 'First' : 'Recent'} occurrence at ${e.occurredAt.toISOString()}`,
        source: e.source,
        sourceReference: `incident_event:${e.id}`,
        sourceUrl: e.sourceUrl,
        content: [
          e.summary ?? '',
          `occurred_at: ${e.occurredAt.toISOString()}`,
          `operation: ${a.operation ?? 'unknown'} route: ${a.httpRoute ?? 'unknown'} status: ${a.httpStatus ?? 'unknown'}`,
          `trace_id: ${e.traceId ?? 'none'}`,
          'stack:',
          ...(a.stack ?? ['(no stack trace)']),
        ].join('\n'),
      });
    }
    coverage.error_events = errors.length;

    // 1b. Alerts routed to this incident (Phase 10), most recent first.
    const routed = await this.db
      .select()
      .from(alerts)
      .where(eq(alerts.incidentId, incidentId))
      .orderBy(desc(alerts.lastFiredAt))
      .limit(LIMITS.alerts);
    for (const a of routed) {
      drafts.push({
        kind: 'alert',
        title: `Alert (${a.status}): ${a.title}`.slice(0, 200),
        source: 'alert',
        sourceReference: `alert:${a.id}`,
        sourceUrl: a.sourceUrl,
        content: [
          a.title,
          `status: ${a.status} severity: ${a.severity} occurrences: ${a.occurrences}`,
          `first_fired: ${a.firstFiredAt.toISOString()} last_fired: ${a.lastFiredAt.toISOString()}${a.resolvedAt ? ` resolved: ${a.resolvedAt.toISOString()}` : ''}`,
          `labels: ${
            Object.entries(a.labels)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ') || 'none'
          }`,
          a.description ? `description:\n${a.description}` : 'description: none',
        ].join('\n'),
      });
    }
    coverage.alerts = routed.length;

    // 2. One full trace of the most recent failure: Jaeger first, then traces sent to our intake.
    const traceId = errors.find((e) => e.traceId)?.traceId;
    if (traceId) {
      try {
        const t = await this.jaeger.client.getTrace(traceId);
        if (t) {
          drafts.push({
            kind: 'trace',
            title: `Trace ${traceId.slice(0, 12)} (${t.spans.length} spans)`,
            source: 'otel_jaeger',
            sourceReference: `trace:${traceId}`,
            sourceUrl: `${this.env.JAEGER_UI_URL}/trace/${traceId}`,
            content: fmtSpan(t),
          });
          coverage.traces = 'ok';
        } else coverage.traces = 'expired';
      } catch (err) {
        coverage.traces = `unavailable: ${(err as Error).message}`;
      }
      if (coverage.traces !== 'ok') {
        const stored = await this.storedTrace(workspaceId, traceId);
        if (stored) {
          drafts.push(stored);
          coverage.traces = 'ok';
        }
      }
    } else coverage.traces = 'none';

    // 2b. Logs around the incident: our own intake (Ways 1-5) and connected tools (Way 7).
    await this.collectLogs(incident, drafts, coverage);

    // 3. Deploys of this service before the last occurrence.
    const deploys =
      incident.serviceName && incident.environment
        ? await this.db
            .select()
            .from(deployments)
            .where(
              and(
                eq(deployments.workspaceId, workspaceId),
                eq(deployments.serviceName, incident.serviceName),
                eq(deployments.environment, incident.environment),
                lte(deployments.deployedAt, incident.lastSeenAt),
              ),
            )
            .orderBy(desc(deployments.deployedAt))
            .limit(LIMITS.deploys)
        : [];
    for (const d of deploys) {
      const minutes = Math.round((incident.firstSeenAt.getTime() - d.deployedAt.getTime()) / 60000);
      drafts.push({
        kind: 'deploy',
        title: `Deploy ${d.version ?? ''} at ${d.deployedAt.toISOString()}`.replace('  ', ' '),
        source: 'deploy_webhook',
        sourceReference: `deployment:${d.id}`,
        sourceUrl: null,
        content: [
          `service: ${d.serviceName} environment: ${d.environment}`,
          `version: ${d.version ?? 'unknown'} commit: ${d.commitSha}`,
          `deployed_at: ${d.deployedAt.toISOString()}`,
          minutes >= 0
            ? `The first error of this incident happened ${minutes} minute(s) after this deploy.`
            : `This deploy happened ${-minutes} minute(s) after the first error.`,
        ].join('\n'),
      });
    }
    coverage.deploys = deploys.length;

    // 4 + 5. Code at the failing frames, and recent commits, through the GitHub App.
    await this.collectCode(incident, service, picked, deploys[0]?.commitSha, drafts, coverage);

    let redactions: Record<string, number> = {};
    const items = drafts.map((d) => {
      const r = redact(d.content);
      redactions = Object.fromEntries(
        [...new Set([...Object.keys(redactions), ...Object.keys(r.counts)])].map((k) => [
          k,
          (redactions[k] ?? 0) + (r.counts[k] ?? 0),
        ]),
      );
      const content =
        r.text.length > LIMITS.itemChars
          ? `${r.text.slice(0, LIMITS.itemChars)}\n[truncated: ${r.text.length - LIMITS.itemChars} more characters not included]`
          : r.text;
      return { ...d, content, contentHash: createHash('sha256').update(content).digest('hex') };
    });
    coverage.redactions = Object.values(redactions).reduce((a, b) => a + b, 0);
    return { items, coverage, redactions };
  }

  private async storedTrace(workspaceId: string, traceId: string): Promise<DraftEvidence | null> {
    const rows = await this.db
      .select()
      .from(spans)
      .where(and(eq(spans.workspaceId, workspaceId), eq(spans.traceId, traceId)))
      .orderBy(asc(spans.startTime))
      .limit(LIMITS.traceSpans);
    if (rows.length === 0) return null;
    const start = rows[0]!.startTime.getTime();
    const content = rows
      .map((s) => {
        const status =
          s.attributes['http.response.status_code'] ?? s.attributes['http.status_code'];
        const exc = s.events.find((e) => e.name === 'exception')?.attributes['exception.message'];
        return `+${s.startTime.getTime() - start}ms ${s.service} ${s.name} (${Math.round(Number(s.durationMs))}ms)${status ? ` status=${scalar(status)}` : ''}${s.statusCode === 2 ? ' ERROR' : ''}${exc ? ` exception="${scalar(exc)}"` : ''}`;
      })
      .join('\n');
    return {
      kind: 'trace',
      title: `Trace ${traceId.slice(0, 12)} (${rows.length} spans)`,
      source: 'ingest',
      sourceReference: `trace:${traceId}`,
      sourceUrl: null,
      content,
    };
  }

  private async collectLogs(
    incident: typeof incidents.$inferSelect,
    drafts: DraftEvidence[],
    coverage: Record<string, CoverageValue>,
  ): Promise<void> {
    const from = new Date(incident.firstSeenAt.getTime() - LOG_WINDOW_BEFORE_MS);
    const to = new Date(Math.min(Date.now(), incident.lastSeenAt.getTime() + LOG_WINDOW_AFTER_MS));
    const line = (ts: string, level: string, service: string | null, msg: string) =>
      `${ts} ${level.toUpperCase().padEnd(5)} ${service ?? ''} ${msg.replace(/\s+/g, ' ').slice(0, 500)}`.trim();

    if (incident.serviceName) {
      // Warnings and errors first (they explain the failure), then the most recent context.
      const where = and(
        eq(logRecords.workspaceId, incident.workspaceId),
        eq(logRecords.service, incident.serviceName),
        gte(logRecords.ts, from),
        lte(logRecords.ts, to),
      );
      const [bad, recent] = await Promise.all([
        this.db
          .select()
          .from(logRecords)
          .where(and(where, inArray(logRecords.level, ['warn', 'error', 'fatal'])))
          .orderBy(desc(logRecords.ts))
          .limit(LIMITS.logLines),
        this.db.select().from(logRecords).where(where).orderBy(desc(logRecords.ts)).limit(10),
      ]);
      const rows = [...bad, ...recent.filter((r) => !bad.some((b) => b.id === r.id))]
        .sort((a, b) => a.ts.getTime() - b.ts.getTime())
        .slice(-LIMITS.logLines);
      if (rows.length > 0) {
        drafts.push({
          kind: 'log',
          title: `Logs from ${incident.serviceName} (${rows.length} lines)`,
          source: 'ingest',
          sourceReference: `logs:${incident.serviceName}:${from.toISOString()}/${to.toISOString()}`,
          sourceUrl: null,
          content: rows
            .map((r) => line(r.ts.toISOString(), r.level, r.service, r.message))
            .join('\n'),
        });
      }
      coverage.logs = rows.length;
    }

    const results = await this.tools.readForIncident(incident.workspaceId, {
      service: incident.serviceName,
      environment: incident.environment,
      from,
      to,
      limit: LIMITS.toolLines,
      errorsOnly: false,
    });
    for (const r of results) {
      coverage[`logs_${r.tool}`] = r.error ? `unavailable: ${r.error}` : r.lines.length;
      if (r.lines.length === 0) continue;
      const lines = [...r.lines].sort((a, b) => a.ts.localeCompare(b.ts));
      drafts.push({
        kind: 'log',
        title: `${r.name}: ${lines.length} log lines`,
        source: r.tool,
        sourceReference: `${r.tool}:${incident.serviceName ?? '*'}:${from.toISOString()}/${to.toISOString()}`,
        sourceUrl: lines.find((l) => l.url)?.url ?? null,
        content: lines.map((l) => line(l.ts, l.level, l.service, l.message)).join('\n'),
      });
      coverage.logs = Number(coverage.logs) + lines.length;
    }
  }

  private async collectCode(
    incident: typeof incidents.$inferSelect,
    service: typeof services.$inferSelect | undefined,
    errors: (typeof incidentEvents.$inferSelect)[],
    deployedSha: string | undefined,
    drafts: DraftEvidence[],
    coverage: Record<string, CoverageValue>,
  ): Promise<void> {
    const repo = service?.repositoryFullName;
    if (!repo) {
      coverage.code = 'unavailable: service not mapped to a repository';
      coverage.commits = coverage.code;
      return;
    }
    const installationId = await this.github.installationFor(incident.workspaceId, repo);
    if (!installationId) {
      coverage.code = `unavailable: no connected GitHub installation can read ${repo}`;
      coverage.commits = coverage.code;
      return;
    }
    const gh = this.github.gh();
    // Read the code that was actually deployed when the deploy marker names a commit.
    const ref =
      deployedSha && /^[0-9a-f]{7,40}$/i.test(deployedSha) ? deployedSha : service.defaultBranch;
    coverage.code_ref = ref;

    try {
      const { paths, truncated } = await gh.tree(installationId, repo, ref);
      const repoPaths = new Set(paths);
      const frames = parseFrames(
        errors.flatMap((e) => (e.attributes as { stack?: string[] }).stack ?? []),
      );
      const seen = new Set<string>();
      const files: { path: string; line: number; fn: string | null }[] = [];
      for (const f of frames) {
        const p = mapToRepoPath(f.path, repoPaths);
        if (!p || seen.has(p)) continue;
        seen.add(p);
        files.push({ path: p, line: f.line, fn: f.fn });
        if (files.length >= LIMITS.codeFiles) break;
      }
      for (const f of files) {
        const source = await gh.fileContent(installationId, repo, f.path, ref);
        const ex = excerpt(source, f.line, LIMITS.codeRadius);
        drafts.push({
          kind: 'code',
          title: `${f.path}:${f.line}${f.fn ? ` (${f.fn})` : ''}`,
          source: 'github',
          sourceReference: `${repo}@${ref}:${f.path}#L${ex.from}-L${ex.to}`,
          sourceUrl: `https://github.com/${repo}/blob/${ref}/${f.path}#L${ex.from}-L${ex.to}`,
          content: `${repo} @ ${ref}\n${f.path} lines ${ex.from}-${ex.to} (>> marks the failing line)\n${ex.text}`,
        });
      }
      coverage.code =
        files.length > 0 ? 'ok' : `unavailable: no stack frame matched a file in ${repo}`;
      if (truncated) coverage.code_tree = 'truncated';

      const top = files[0]?.path;
      const commits = await gh.listCommits(installationId, repo, {
        sha: ref,
        path: top,
        limit: LIMITS.commits,
      });
      for (const c of commits) {
        drafts.push({
          kind: 'commit',
          title: `Commit ${c.sha.slice(0, 7)}: ${c.commit.message.split('\n')[0]}`,
          source: 'github',
          sourceReference: `${repo}@${c.sha}`,
          sourceUrl: c.html_url,
          content: [
            `sha: ${c.sha}`,
            `author: ${c.commit.author?.name ?? 'unknown'} date: ${c.commit.author?.date ?? 'unknown'}`,
            top ? `touches: ${top}` : '',
            '',
            c.commit.message.slice(0, 2000),
          ].join('\n'),
        });
      }
      coverage.commits = commits.length;
    } catch (err) {
      this.logger.warn(`GitHub evidence failed for ${repo}: ${(err as Error).message}`);
      coverage.code = `unavailable: ${(err as Error).message}`;
      coverage.commits ??= coverage.code;
    }
  }
}
