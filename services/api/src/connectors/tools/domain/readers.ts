import type { ConnectReaderInput, ReaderLogLine, ToolId } from '@ape/api-contracts';
import {
  asText,
  basic,
  call,
  guessLevel,
  trimBase,
  type FetchFn,
  type ReaderConfig,
  type ReaderQuery,
} from './reader-http';
import { signAwsRequest } from './aws-sigv4';

export { ReaderError } from './reader-http';
export type { FetchFn, ReaderConfig, ReaderQuery } from './reader-http';
export { signAwsRequest } from './aws-sigv4';

function lokiQuery(label: string, q: ReaderQuery): string {
  const selector = q.service
    ? `{${label}="${q.service.replace(/["\\]/g, '\\$&')}"}`
    : `{${label}=~".+"}`;
  return q.errorsOnly ? `${selector} |~ "(?i)(error|exception|fatal|panic)"` : selector;
}

const lokiEndpoint = (url: string): string => {
  const base = trimBase(url);
  return /\/loki\/api\/v1$/.test(base) ? `${base}/query_range` : `${base}/loki/api/v1/query_range`;
};

interface LokiResponse {
  data?: { result?: { stream?: Record<string, string>; values?: [string, string][] }[] };
}

function lokiLines(data: LokiResponse | null, label: string): ReaderLogLine[] {
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

async function loki(cfg: ReaderConfig, q: ReaderQuery, fetchFn: FetchFn): Promise<ReaderLogLine[]> {
  const { url, auth, username, orgId, serviceLabel } = cfg.settings;
  const label = (serviceLabel || 'service_name').replace(/[^A-Za-z0-9_]/g, '');
  const params = new URLSearchParams({
    query: lokiQuery(label, q),
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
  const data = (await call(
    fetchFn,
    `${lokiEndpoint(url!)}?${params}`,
    { headers },
    'Loki',
  )) as LokiResponse | null;
  return lokiLines(data, label);
}

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

const SECRET_FIELDS: Record<ToolId, string[]> = {
  grafana: ['token'],
  datadog: ['apiKey', 'appKey'],
  sentry: ['token'],
  betterstack: ['password'],
  cloudwatch: ['secretAccessKey'],
  elasticsearch: ['token'],
};

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
