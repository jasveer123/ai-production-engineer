import { createHash, createHmac } from 'node:crypto';
import type { ConnectReaderInput, ReaderLogLine, ToolId } from '@ape/api-contracts';

/**
 * Read-only log readers for Way 7. Each takes stored settings + secrets and answers one bounded
 * question: "lines for this service in this time window". They never write to the tool.
 */
export interface ReaderQuery {
  service: string | null;
  environment: string | null;
  from: Date;
  to: Date;
  limit: number;
  /** Prefer error lines where the tool can filter cheaply. */
  errorsOnly?: boolean;
}

export type ReaderConfig = { settings: Record<string, string>; secrets: Record<string, string> };

export type FetchFn = typeof fetch;

export class ReaderError extends Error {}

const TIMEOUT_MS = 10_000;

async function call(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  tool: string,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchFn(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'error',
    });
  } catch (err) {
    const e = err as Error;
    throw new ReaderError(
      e.name === 'TimeoutError'
        ? `${tool} did not answer within 10 seconds`
        : `Could not reach ${tool}: ${e.message}`,
    );
  }
  const body = await res.text();
  if (res.status === 401 || res.status === 403)
    throw new ReaderError(
      `${tool} rejected the credentials (HTTP ${res.status}). Check the key and its read permission.`,
    );
  if (!res.ok) throw new ReaderError(`${tool} answered HTTP ${res.status}: ${body.slice(0, 200)}`);
  if (!body.trim()) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    // ClickHouse JSONEachRow: one object per line.
    return body
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as unknown);
  }
}

/** Scalars as text, objects as JSON: log fields can be either. */
const asText = (v: unknown): string =>
  typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : JSON.stringify(v);

const trimBase = (u: string) => u.replace(/\/+$/, '');
const basic = (user: string, pass: string) =>
  `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const LEVEL_WORDS = /\b(fatal|panic|critical|error|err|exception|warn(?:ing)?|info|debug)\b/i;
const guessLevel = (line: string, fallback = 'info') =>
  LEVEL_WORDS.exec(line)?.[1]
    ?.toLowerCase()
    .replace(/^err$/, 'error')
    .replace('warning', 'warn')
    .replace('exception', 'error') ?? fallback;

// ---------- Grafana Loki ----------

async function loki(cfg: ReaderConfig, q: ReaderQuery, fetchFn: FetchFn): Promise<ReaderLogLine[]> {
  const { url, auth, username, orgId, serviceLabel } = cfg.settings;
  const label = (serviceLabel || 'service_name').replace(/[^A-Za-z0-9_]/g, '');
  const selector = q.service
    ? `{${label}="${q.service.replace(/["\\]/g, '\\$&')}"}`
    : `{${label}=~".+"}`;
  const query = q.errorsOnly ? `${selector} |~ "(?i)(error|exception|fatal|panic)"` : selector;
  const base = trimBase(url!);
  const endpoint = /\/loki\/api\/v1$/.test(base)
    ? `${base}/query_range`
    : `${base}/loki/api/v1/query_range`;
  const params = new URLSearchParams({
    query,
    start: String(BigInt(q.from.getTime()) * 1_000_000n),
    end: String(BigInt(q.to.getTime()) * 1_000_000n),
    limit: String(q.limit),
    direction: 'backward',
  });
  const headers: Record<string, string> = {
    Authorization:
      auth === 'basic' ? basic(username ?? '', cfg.secrets.token!) : `Bearer ${cfg.secrets.token}`,
  };
  if (orgId) headers['X-Scope-OrgID'] = orgId;
  const data = (await call(fetchFn, `${endpoint}?${params}`, { headers }, 'Loki')) as {
    data?: { result?: { stream?: Record<string, string>; values?: [string, string][] }[] };
  } | null;
  const lines: ReaderLogLine[] = [];
  for (const r of data?.data?.result ?? []) {
    for (const [ns, line] of r.values ?? []) {
      lines.push({
        ts: new Date(Number(BigInt(ns) / 1_000_000n)).toISOString(),
        level: r.stream?.level ?? r.stream?.detected_level ?? guessLevel(line),
        message: line,
        service: r.stream?.[label] ?? null,
        url: null,
      });
    }
  }
  return lines;
}

// ---------- Datadog ----------

async function datadog(
  cfg: ReaderConfig,
  q: ReaderQuery,
  fetchFn: FetchFn,
): Promise<ReaderLogLine[]> {
  const site = cfg.settings.site || 'datadoghq.com';
  const parts: string[] = [];
  if (q.service) parts.push(`service:${JSON.stringify(q.service)}`);
  if (q.environment) parts.push(`env:${JSON.stringify(q.environment)}`);
  if (q.errorsOnly) parts.push('status:(error OR critical OR emergency OR alert)');
  const query = parts.join(' ') || '*';
  const data = (await call(
    fetchFn,
    `https://api.${site}/api/v2/logs/events/search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': cfg.secrets.apiKey!,
        'DD-APPLICATION-KEY': cfg.secrets.appKey!,
      },
      body: JSON.stringify({
        filter: { query, from: q.from.toISOString(), to: q.to.toISOString() },
        sort: '-timestamp',
        page: { limit: q.limit },
      }),
    },
    'Datadog',
  )) as {
    data?: {
      id?: string;
      attributes?: { timestamp?: string; status?: string; message?: string; service?: string };
    }[];
  } | null;
  const link = `https://app.${site}/logs?query=${encodeURIComponent(query)}`;
  return (data?.data ?? []).map((d) => ({
    ts: d.attributes?.timestamp ?? q.to.toISOString(),
    level: d.attributes?.status ?? 'info',
    message: d.attributes?.message ?? '',
    service: d.attributes?.service ?? null,
    url: d.id ? `${link}&event=${encodeURIComponent(d.id)}` : link,
  }));
}

// ---------- Sentry ----------

async function sentry(
  cfg: ReaderConfig,
  q: ReaderQuery,
  fetchFn: FetchFn,
): Promise<ReaderLogLine[]> {
  const base = trimBase(cfg.settings.url || 'https://sentry.io');
  const org = encodeURIComponent(cfg.settings.organization!);
  const params = new URLSearchParams({
    query: 'is:unresolved',
    start: q.from.toISOString(),
    end: q.to.toISOString(),
    sort: 'date',
    limit: String(Math.min(q.limit, 100)),
  });
  if (q.environment) params.set('environment', q.environment);
  const data = (await call(
    fetchFn,
    `${base}/api/0/organizations/${org}/issues/?${params}`,
    { headers: { Authorization: `Bearer ${cfg.secrets.token}` } },
    'Sentry',
  )) as
    | {
        title?: string;
        culprit?: string;
        lastSeen?: string;
        level?: string;
        permalink?: string;
        count?: string;
        project?: { slug?: string };
      }[]
    | null;
  return (Array.isArray(data) ? data : []).map((i) => ({
    ts: i.lastSeen ?? q.to.toISOString(),
    level: i.level ?? 'error',
    message: `${i.title ?? 'Issue'}${i.culprit ? ` in ${i.culprit}` : ''}${i.count ? ` (${i.count} events)` : ''}`,
    service: i.project?.slug ?? null,
    url: i.permalink ?? null,
  }));
}

// ---------- Better Stack Telemetry (ClickHouse over HTTP) ----------

async function betterstack(
  cfg: ReaderConfig,
  q: ReaderQuery,
  fetchFn: FetchFn,
): Promise<ReaderLogLine[]> {
  const table = cfg.settings.table!.replace(/[^A-Za-z0-9_]/g, '');
  const where = [
    'dt BETWEEN parseDateTime64BestEffort({from:String}) AND parseDateTime64BestEffort({to:String})',
  ];
  const params = new URLSearchParams({
    param_from: q.from.toISOString(),
    param_to: q.to.toISOString(),
  });
  if (q.service) {
    where.push(
      "(JSONExtractString(raw, 'service') = {service:String} OR JSONExtractString(raw, 'service', 'name') = {service:String} OR JSONExtractString(raw, 'resource', 'service.name') = {service:String})",
    );
    params.set('param_service', q.service);
  }
  if (q.errorsOnly) where.push("positionCaseInsensitive(raw, 'error') > 0");
  const sql = `SELECT dt, raw FROM remote(${table}) WHERE ${where.join(' AND ')} ORDER BY dt DESC LIMIT ${q.limit} FORMAT JSONEachRow`;
  const rows = (await call(
    fetchFn,
    `${trimBase(cfg.settings.url!)}/?${params}`,
    {
      method: 'POST',
      headers: {
        Authorization: basic(cfg.settings.username!, cfg.secrets.password!),
        'Content-Type': 'text/plain',
      },
      body: sql,
    },
    'Better Stack',
  )) as { dt?: string; raw?: string }[] | Record<string, unknown> | null;
  return (Array.isArray(rows) ? rows : rows ? [rows as { dt?: string; raw?: string }] : []).map(
    (r) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(r.raw ?? '{}') as Record<string, unknown>;
      } catch {
        parsed = { message: r.raw };
      }
      const message = asText(parsed.message ?? parsed.msg ?? r.raw ?? '');
      return {
        ts: new Date(
          `${(r.dt ?? '').replace(' ', 'T')}${/Z|[+-]\d\d:?\d\d$/.test(r.dt ?? '') ? '' : 'Z'}`,
        ).toISOString(),
        level: asText(parsed.level ?? parsed.severity ?? guessLevel(message)),
        message,
        service: typeof parsed.service === 'string' ? parsed.service : null,
        url: null,
      };
    },
  );
}

// ---------- Amazon CloudWatch Logs (SigV4, FilterLogEvents) ----------

const sha256hex = (s: string) => createHash('sha256').update(s).digest('hex');
const hmac = (key: Buffer | string, s: string) => createHmac('sha256', key).update(s).digest();

/** AWS Signature Version 4 for a JSON POST to `host` (service `logs`). */
export function signAwsRequest(opts: {
  region: string;
  service: string;
  host: string;
  target: string;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  now?: Date;
}): Record<string, string> {
  const now = opts.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    'content-type': 'application/x-amz-json-1.1',
    host: opts.host,
    'x-amz-date': amzDate,
    'x-amz-target': opts.target,
  };
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(';');
  const canonicalRequest = [
    'POST',
    '/',
    '', // no query string
    names.map((k) => `${k}:${headers[k]}\n`).join(''),
    signedHeaders,
    sha256hex(opts.body),
  ].join('\n');
  const scope = `${day}/${opts.region}/${opts.service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${opts.secretAccessKey}`, day);
  const kSigning = hmac(hmac(hmac(kDate, opts.region), opts.service), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(toSign).digest('hex');
  return {
    'Content-Type': headers['content-type']!,
    'X-Amz-Date': amzDate,
    'X-Amz-Target': opts.target,
    Authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

async function cloudwatch(
  cfg: ReaderConfig,
  q: ReaderQuery,
  fetchFn: FetchFn,
): Promise<ReaderLogLine[]> {
  const region = cfg.settings.region!;
  const host = `logs.${region}.amazonaws.com`;
  const groups = (cfg.settings.logGroups ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
  const lines: ReaderLogLine[] = [];
  for (const group of groups.slice(0, 5)) {
    const terms: string[] = [];
    if (q.errorsOnly) terms.push('?ERROR ?Error ?error ?Exception ?FATAL');
    if (q.service) terms.push(`"${q.service.replace(/"/g, '')}"`);
    const body = JSON.stringify({
      logGroupName: group,
      startTime: q.from.getTime(),
      endTime: q.to.getTime(),
      limit: q.limit,
      ...(terms.length ? { filterPattern: terms.join(' ') } : {}),
    });
    const headers = signAwsRequest({
      region,
      service: 'logs',
      host,
      target: 'Logs_20140328.FilterLogEvents',
      body,
      accessKeyId: cfg.settings.accessKeyId!,
      secretAccessKey: cfg.secrets.secretAccessKey!,
    });
    const data = (await call(
      fetchFn,
      `https://${host}/`,
      { method: 'POST', headers, body },
      'CloudWatch',
    )) as {
      events?: { timestamp?: number; message?: string; logStreamName?: string }[];
    } | null;
    for (const e of data?.events ?? []) {
      lines.push({
        ts: new Date(e.timestamp ?? q.to.getTime()).toISOString(),
        level: guessLevel(e.message ?? ''),
        message: (e.message ?? '').trimEnd(),
        service: q.service,
        url: `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${encodeURIComponent(encodeURIComponent(group))}`,
      });
    }
  }
  return lines.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, q.limit);
}

// ---------- Elasticsearch ----------

async function elasticsearch(
  cfg: ReaderConfig,
  q: ReaderQuery,
  fetchFn: FetchFn,
): Promise<ReaderLogLine[]> {
  const { url, auth, username, index, serviceField } = cfg.settings;
  const filter: unknown[] = [
    { range: { '@timestamp': { gte: q.from.toISOString(), lte: q.to.toISOString() } } },
  ];
  if (q.service) filter.push({ match_phrase: { [serviceField || 'service.name']: q.service } });
  if (q.errorsOnly)
    filter.push({
      bool: {
        should: [
          { terms: { 'log.level': ['error', 'ERROR', 'fatal', 'FATAL', 'critical'] } },
          { exists: { field: 'error.message' } },
        ],
        minimum_should_match: 1,
      },
    });
  const data = (await call(
    fetchFn,
    `${trimBase(url!)}/${encodeURIComponent(index || 'logs-*')
      .replace(/%2A/g, '*')
      .replace(/%2C/g, ',')}/_search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          auth === 'basic'
            ? basic(username ?? '', cfg.secrets.token!)
            : `ApiKey ${cfg.secrets.token}`,
      },
      body: JSON.stringify({
        size: q.limit,
        sort: [{ '@timestamp': 'desc' }],
        query: { bool: { filter } },
        _source: [
          '@timestamp',
          'message',
          'log.level',
          'level',
          'service.name',
          serviceField || 'service.name',
          'error.message',
        ],
      }),
    },
    'Elasticsearch',
  )) as { hits?: { hits?: { _source?: Record<string, unknown> }[] } } | null;
  const get = (src: Record<string, unknown>, path: string): unknown =>
    path in src
      ? src[path]
      : path
          .split('.')
          .reduce<unknown>(
            (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
            src,
          );
  return (data?.hits?.hits ?? []).map((h) => {
    const s = h._source ?? {};
    const message = asText(get(s, 'message') ?? get(s, 'error.message') ?? JSON.stringify(s));
    return {
      ts: asText(get(s, '@timestamp') ?? q.to.toISOString()),
      level: asText(get(s, 'log.level') ?? get(s, 'level') ?? guessLevel(message)),
      message,
      service: (get(s, serviceField || 'service.name') as string | undefined) ?? null,
      url: null,
    };
  });
}

const READERS: Record<
  ToolId,
  (cfg: ReaderConfig, q: ReaderQuery, fetchFn: FetchFn) => Promise<ReaderLogLine[]>
> = {
  grafana: loki,
  datadog,
  sentry,
  betterstack,
  cloudwatch,
  elasticsearch,
};

export function readLogs(
  tool: ToolId,
  cfg: ReaderConfig,
  q: ReaderQuery,
  fetchFn: FetchFn = fetch,
): Promise<ReaderLogLine[]> {
  return READERS[tool](cfg, q, fetchFn);
}

/** Field names that are secrets per tool; everything else is a visible setting. */
const SECRET_FIELDS: Record<ToolId, string[]> = {
  grafana: ['token'],
  datadog: ['apiKey', 'appKey'],
  sentry: ['token'],
  betterstack: ['password'],
  cloudwatch: ['secretAccessKey'],
  elasticsearch: ['token'],
};

/** Splits validated input into visible settings and encrypted secrets. */
export function splitReaderInput(input: ConnectReaderInput & { tool: ToolId }): ReaderConfig {
  const settings: Record<string, string> = {};
  const secrets: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === 'tool' || v === undefined || v === null) continue;
    const value = Array.isArray(v) ? v.join(',') : String(v);
    if (SECRET_FIELDS[input.tool].includes(k)) secrets[k] = value;
    else settings[k] = value;
  }
  return { settings, secrets };
}
