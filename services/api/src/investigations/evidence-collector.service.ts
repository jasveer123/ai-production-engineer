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
import { JaegerPoller } from '../ingestion/jaeger.poller';
import { excerpt, mapToRepoPath, parseFrames } from './code-paths';
import {
  alertDraft,
  deployDraft,
  errorEventDraft,
  finalizeEvidence,
  formatJaegerTrace,
  formatStoredTrace,
  LIMITS,
  logLine,
  type CollectedEvidence,
  type DraftEvidence,
  type Gathered,
} from './evidence-format';

type IncidentRow = typeof incidents.$inferSelect;
type EventRow = typeof incidentEvents.$inferSelect;

/** Logs are read from 15 minutes before the first error to 5 minutes after the last one. */
const LOG_WINDOW_BEFORE_MS = 15 * 60_000;
const LOG_WINDOW_AFTER_MS = 5 * 60_000;

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
      ? await this.db
          .select()
          .from(services)
          .where(and(eq(services.id, incident.serviceId), eq(services.workspaceId, workspaceId)))
      : [];

    const out: Gathered = { drafts: [], coverage: { logs: 0, metrics: 'not_supported' } };
    const { errors, picked } = await this.collectErrors(incident, out);
    await this.collectAlerts(incident, out);
    await this.collectTrace(incident, errors.find((e) => e.traceId)?.traceId, out);
    // Logs around the incident: our own intake (Ways 1-5) and connected tools (Way 7).
    await this.collectLogs(incident, out);
    const deploys = await this.collectDeploys(incident, out);
    // Code at the failing frames, and recent commits, through the GitHub App.
    await this.collectCode(
      { incident, service, errors: picked, deployedSha: deploys[0]?.commitSha },
      out,
    );

    const { items, redactions } = finalizeEvidence(out.drafts);
    out.coverage.redactions = Object.values(redactions).reduce((a, b) => a + b, 0);
    return { items, coverage: out.coverage, redactions };
  }

  /** Error occurrences: the first one and the most recent ones. */
  private async collectErrors(
    incident: IncidentRow,
    out: Gathered,
  ): Promise<{ errors: EventRow[]; picked: EventRow[] }> {
    const forIncident = and(
      eq(incidentEvents.incidentId, incident.id),
      eq(incidentEvents.workspaceId, incident.workspaceId),
      eq(incidentEvents.kind, 'error'),
    );
    const errors = await this.db
      .select()
      .from(incidentEvents)
      .where(forIncident)
      .orderBy(desc(incidentEvents.occurredAt))
      .limit(50);
    const [first] = await this.db
      .select()
      .from(incidentEvents)
      .where(forIncident)
      .orderBy(asc(incidentEvents.occurredAt))
      .limit(1);
    const picked = [...errors.slice(0, LIMITS.errorEvents - 1), ...(first ? [first] : [])].filter(
      (e, i, a) => a.findIndex((x) => x.id === e.id) === i,
    );
    for (const e of picked) out.drafts.push(errorEventDraft(e, e === first));
    out.coverage.error_events = errors.length;
    return { errors, picked };
  }

  /** Alerts routed to this incident (Phase 10), most recent first. */
  private async collectAlerts(incident: IncidentRow, out: Gathered): Promise<void> {
    const routed = await this.db
      .select()
      .from(alerts)
      .where(and(eq(alerts.incidentId, incident.id), eq(alerts.workspaceId, incident.workspaceId)))
      .orderBy(desc(alerts.lastFiredAt))
      .limit(LIMITS.alerts);
    for (const a of routed) out.drafts.push(alertDraft(a));
    out.coverage.alerts = routed.length;
  }

  /** One full trace of the most recent failure: Jaeger first, then traces sent to our intake. */
  private async collectTrace(
    incident: IncidentRow,
    traceId: string | null | undefined,
    out: Gathered,
  ): Promise<void> {
    if (!traceId) {
      out.coverage.traces = 'none';
      return;
    }
    try {
      const t = await this.jaeger.client.getTrace(traceId);
      if (t) {
        out.drafts.push({
          kind: 'trace',
          title: `Trace ${traceId.slice(0, 12)} (${t.spans.length} spans)`,
          source: 'otel_jaeger',
          sourceReference: `trace:${traceId}`,
          sourceUrl: `${this.env.JAEGER_UI_URL}/trace/${traceId}`,
          content: formatJaegerTrace(t),
        });
        out.coverage.traces = 'ok';
      } else out.coverage.traces = 'expired';
    } catch (err) {
      out.coverage.traces = `unavailable: ${(err as Error).message}`;
    }
    if (out.coverage.traces === 'ok') return;
    const stored = await this.storedTrace(incident.workspaceId, traceId);
    if (stored) {
      out.drafts.push(stored);
      out.coverage.traces = 'ok';
    }
  }

  /** Deploys of this service before the last occurrence. */
  private async collectDeploys(incident: IncidentRow, out: Gathered) {
    const deploys =
      incident.serviceName && incident.environment
        ? await this.db
            .select()
            .from(deployments)
            .where(
              and(
                eq(deployments.workspaceId, incident.workspaceId),
                eq(deployments.serviceName, incident.serviceName),
                eq(deployments.environment, incident.environment),
                lte(deployments.deployedAt, incident.lastSeenAt),
              ),
            )
            .orderBy(desc(deployments.deployedAt))
            .limit(LIMITS.deploys)
        : [];
    for (const d of deploys) out.drafts.push(deployDraft(d, incident));
    out.coverage.deploys = deploys.length;
    return deploys;
  }

  private async storedTrace(workspaceId: string, traceId: string): Promise<DraftEvidence | null> {
    const rows = await this.db
      .select()
      .from(spans)
      .where(and(eq(spans.workspaceId, workspaceId), eq(spans.traceId, traceId)))
      .orderBy(asc(spans.startTime))
      .limit(LIMITS.traceSpans);
    if (rows.length === 0) return null;
    return {
      kind: 'trace',
      title: `Trace ${traceId.slice(0, 12)} (${rows.length} spans)`,
      source: 'ingest',
      sourceReference: `trace:${traceId}`,
      sourceUrl: null,
      content: formatStoredTrace(rows),
    };
  }

  private async collectLogs(incident: IncidentRow, out: Gathered): Promise<void> {
    const from = new Date(incident.firstSeenAt.getTime() - LOG_WINDOW_BEFORE_MS);
    const to = new Date(Math.min(Date.now(), incident.lastSeenAt.getTime() + LOG_WINDOW_AFTER_MS));
    if (incident.serviceName) await this.collectOwnLogs(incident, { from, to }, out);

    const results = await this.tools.readForIncident(incident.workspaceId, {
      service: incident.serviceName,
      environment: incident.environment,
      from,
      to,
      limit: LIMITS.toolLines,
      errorsOnly: false,
    });
    for (const r of results) {
      out.coverage[`logs_${r.tool}`] = r.error ? `unavailable: ${r.error}` : r.lines.length;
      if (r.lines.length === 0) continue;
      const lines = [...r.lines].sort((a, b) => a.ts.localeCompare(b.ts));
      out.drafts.push({
        kind: 'log',
        title: `${r.name}: ${lines.length} log lines`,
        source: r.tool,
        sourceReference: `${r.tool}:${incident.serviceName ?? '*'}:${from.toISOString()}/${to.toISOString()}`,
        sourceUrl: lines.find((l) => l.url)?.url ?? null,
        content: lines.map((l) => logLine(l.ts, l.level, l.service, l.message)).join('\n'),
      });
      out.coverage.logs = Number(out.coverage.logs) + lines.length;
    }
  }

  /** Warnings and errors first (they explain the failure), then the most recent context. */
  private async collectOwnLogs(
    incident: IncidentRow,
    window: { from: Date; to: Date },
    out: Gathered,
  ): Promise<void> {
    const { from, to } = window;
    const where = and(
      eq(logRecords.workspaceId, incident.workspaceId),
      eq(logRecords.service, incident.serviceName!),
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
      out.drafts.push({
        kind: 'log',
        title: `Logs from ${incident.serviceName} (${rows.length} lines)`,
        source: 'ingest',
        sourceReference: `logs:${incident.serviceName}:${from.toISOString()}/${to.toISOString()}`,
        sourceUrl: null,
        content: rows
          .map((r) => logLine(r.ts.toISOString(), r.level, r.service, r.message))
          .join('\n'),
      });
    }
    out.coverage.logs = rows.length;
  }

  private async collectCode(input: CodeInput, out: Gathered): Promise<void> {
    const { incident, service, errors, deployedSha } = input;
    const repo = service?.repositoryFullName;
    if (!repo) {
      out.coverage.code = 'unavailable: service not mapped to a repository';
      out.coverage.commits = out.coverage.code;
      return;
    }
    const installationId = await this.github.installationFor(incident.workspaceId, repo);
    if (!installationId) {
      out.coverage.code = `unavailable: no connected GitHub installation can read ${repo}`;
      out.coverage.commits = out.coverage.code;
      return;
    }
    // Read the code that was actually deployed when the deploy marker names a commit.
    const ref =
      deployedSha && /^[0-9a-f]{7,40}$/i.test(deployedSha) ? deployedSha : service.defaultBranch;
    out.coverage.code_ref = ref;
    const at = { installationId, repo, ref };

    try {
      const files = await this.collectCodeFiles(at, errors, out);
      await this.collectCommits(at, files[0]?.path, out);
    } catch (err) {
      this.logger.warn(`GitHub evidence failed for ${repo}: ${(err as Error).message}`);
      out.coverage.code = `unavailable: ${(err as Error).message}`;
      out.coverage.commits ??= out.coverage.code;
    }
  }

  /** Source excerpts around the frames of the failure that map to files in the repository. */
  private async collectCodeFiles(at: RepoAt, errors: EventRow[], out: Gathered) {
    const { installationId, repo, ref } = at;
    const gh = this.github.gh();
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
      out.drafts.push({
        kind: 'code',
        title: `${f.path}:${f.line}${f.fn ? ` (${f.fn})` : ''}`,
        source: 'github',
        sourceReference: `${repo}@${ref}:${f.path}#L${ex.from}-L${ex.to}`,
        sourceUrl: `https://github.com/${repo}/blob/${ref}/${f.path}#L${ex.from}-L${ex.to}`,
        content: `${repo} @ ${ref}\n${f.path} lines ${ex.from}-${ex.to} (>> marks the failing line)\n${ex.text}`,
      });
    }
    out.coverage.code =
      files.length > 0 ? 'ok' : `unavailable: no stack frame matched a file in ${repo}`;
    if (truncated) out.coverage.code_tree = 'truncated';
    return files;
  }

  private async collectCommits(at: RepoAt, top: string | undefined, out: Gathered) {
    const { installationId, repo, ref } = at;
    const commits = await this.github
      .gh()
      .listCommits(installationId, repo, { sha: ref, path: top, limit: LIMITS.commits });
    for (const c of commits) {
      out.drafts.push({
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
    out.coverage.commits = commits.length;
  }
}

interface CodeInput {
  incident: IncidentRow;
  service: typeof services.$inferSelect | undefined;
  errors: EventRow[];
  deployedSha: string | undefined;
}

interface RepoAt {
  installationId: number;
  repo: string;
  ref: string;
}
