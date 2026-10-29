import { LOG_LEVELS, type LogLevel } from '@ape/api-contracts';

export interface ParsedLogQuery {
  levels: LogLevel[];
  services: string[];
  environments: string[];
  traceIds: string[];
  hosts: string[];
  ways: string[];

  text: string[];
}

const LEVEL_ALIASES: Record<string, LogLevel> = {
  warning: 'warn',
  err: 'error',
  critical: 'fatal',
};

export function parseLogQuery(input: string): ParsedLogQuery {
  const q: ParsedLogQuery = {
    levels: [],
    services: [],
    environments: [],
    traceIds: [],
    hosts: [],
    ways: [],
    text: [],
  };
  for (const raw of input.match(/"[^"]*"|\S+/g) ?? []) addTerm(q, raw);
  return q;
}

type ListField = 'services' | 'environments' | 'traceIds' | 'hosts' | 'ways';
const FILTER_FIELDS = new Map<string, ListField>([
  ['service', 'services'],
  ['env', 'environments'],
  ['environment', 'environments'],
  ['trace', 'traceIds'],
  ['host', 'hosts'],
  ['way', 'ways'],
]);

function splitTerm(raw: string): { key: string; values: string[] } {
  const sep = raw.indexOf(':');
  if (sep <= 0) return { key: '', values: [] };
  const values = raw
    .slice(sep + 1)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return { key: raw.slice(0, sep).toLowerCase(), values };
}

function addLevels(q: ParsedLogQuery, values: string[]): boolean {
  const levels = values.map((v) => LEVEL_ALIASES[v.toLowerCase()] ?? v.toLowerCase());
  if (!values.length || !levels.every((l) => (LOG_LEVELS as readonly string[]).includes(l)))
    return false;
  q.levels.push(...(levels as LogLevel[]));
  return true;
}

function addTerm(q: ParsedLogQuery, raw: string): void {
  if (raw.startsWith('"')) {
    const phrase = raw.slice(1, -1).trim();
    if (phrase) q.text.push(phrase.toLowerCase());
    return;
  }
  const { key, values } = splitTerm(raw);
  if (key === 'level' && addLevels(q, values)) return;
  const field = FILTER_FIELDS.get(key);
  if (field && values.length) q[field].push(...values.map((v) => v.toLowerCase()));
  else q.text.push(raw.toLowerCase());
}

export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
