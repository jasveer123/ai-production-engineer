import type { LogLevel, LogLine, LogQuery } from './types';

const LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

function isLevel(value: string): value is LogLevel {
  return (LEVELS as readonly string[]).includes(value);
}

export function parseLogQuery(input: string): LogQuery {
  const query: LogQuery = { levels: [], services: [], traceIds: [], text: [] };
  const tokens = input.match(/"[^"]*"|\S+/g) ?? [];
  for (const raw of tokens) {
    if (raw.startsWith('"')) {
      const phrase = raw.slice(1, -1).trim();
      if (phrase) query.text.push(phrase.toLowerCase());
      continue;
    }
    const sep = raw.indexOf(':');
    const key = sep > 0 ? raw.slice(0, sep).toLowerCase() : '';
    const value = sep > 0 ? raw.slice(sep + 1) : '';
    if (key === 'level' && isLevel(value.toLowerCase()))
      query.levels.push(value.toLowerCase() as LogLevel);
    else if (key === 'service' && value) query.services.push(value.toLowerCase());
    else if (key === 'trace' && value) query.traceIds.push(value.toLowerCase());
    else query.text.push(raw.toLowerCase());
  }
  return query;
}

export function matchesLogQuery(line: LogLine, query: LogQuery): boolean {
  if (query.levels.length && !query.levels.includes(line.level)) return false;
  if (query.services.length && !query.services.includes(line.service.toLowerCase())) return false;
  if (query.traceIds.length) {
    const trace = line.traceId?.toLowerCase() ?? '';
    if (!query.traceIds.some((t) => trace.startsWith(t))) return false;
  }
  const message = line.message.toLowerCase();
  return query.text.every((t) => message.includes(t));
}

export function filterLogs(lines: LogLine[], input: string): LogLine[] {
  const query = parseLogQuery(input);
  return lines.filter((line) => matchesLogQuery(line, query));
}

export type LogBucket = { start: string; total: number; errors: number };

export function bucketLogs(
  lines: LogLine[],
  bucketMs: number,
  from: string,
  count: number,
): LogBucket[] {
  const start = new Date(from).getTime();
  const buckets: LogBucket[] = Array.from({ length: count }, (_, i) => ({
    start: new Date(start + i * bucketMs).toISOString(),
    total: 0,
    errors: 0,
  }));
  for (const line of lines) {
    const index = Math.floor((new Date(line.at).getTime() - start) / bucketMs);
    if (index < 0 || index >= count) continue;
    buckets[index].total += 1;
    if (line.level === 'error') buckets[index].errors += 1;
  }
  return buckets;
}
