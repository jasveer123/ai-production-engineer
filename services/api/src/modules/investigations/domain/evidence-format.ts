import { createHash } from 'node:crypto';
import type {
  alerts,
  deployments,
  incidentEvents,
  incidents,
  spans,
} from '../../../core/db/schema';
import { str, type JaegerTrace } from '../../../ingest/ingestion/infrastructure/jaeger';
import { redact } from './redact';

export const LIMITS = {
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

export interface Gathered {
  drafts: DraftEvidence[];
  coverage: Record<string, CoverageValue>;
}

type IncidentRow = typeof incidents.$inferSelect;
type EventRow = typeof incidentEvents.$inferSelect;

const scalar = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    ? String(v)
    : JSON.stringify(v);

export const logLine = (ts: string, level: string, service: string | null, msg: string): string =>
  `${ts} ${level.toUpperCase().padEnd(5)} ${service ?? ''} ${msg.replace(/\s+/g, ' ').slice(0, 500)}`.trim();

export function formatJaegerTrace(t: JaegerTrace): string {
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
}

export function formatStoredTrace(rows: (typeof spans.$inferSelect)[]): string {
  const start = rows[0]!.startTime.getTime();
  return rows
    .map((s) => {
      const status = s.attributes['http.response.status_code'] ?? s.attributes['http.status_code'];
      const exc = s.events.find((e) => e.name === 'exception')?.attributes['exception.message'];
      return `+${s.startTime.getTime() - start}ms ${s.service} ${s.name} (${Math.round(Number(s.durationMs))}ms)${status ? ` status=${scalar(status)}` : ''}${s.statusCode === 2 ? ' ERROR' : ''}${exc ? ` exception="${scalar(exc)}"` : ''}`;
    })
    .join('\n');
}

export function errorEventDraft(e: EventRow, isFirst: boolean): DraftEvidence {
  const a = e.attributes as {
    stack?: string[];
    httpRoute?: string;
    httpStatus?: number;
    operation?: string;
  };
  return {
    kind: 'error_event',
    title: `${isFirst ? 'First' : 'Recent'} occurrence at ${e.occurredAt.toISOString()}`,
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
  };
}

export function alertDraft(a: typeof alerts.$inferSelect): DraftEvidence {
  return {
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
  };
}

export function deployDraft(
  d: typeof deployments.$inferSelect,
  incident: Pick<IncidentRow, 'firstSeenAt'>,
): DraftEvidence {
  const minutes = Math.round((incident.firstSeenAt.getTime() - d.deployedAt.getTime()) / 60000);
  return {
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
  };
}

export function finalizeEvidence(drafts: DraftEvidence[]): {
  items: CollectedEvidence['items'];
  redactions: Record<string, number>;
} {
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
  return { items, redactions };
}
