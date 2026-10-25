import { LOG_LEVELS, type LogLevel } from '@ape/api-contracts';

export interface ParsedLogQuery {
  levels: LogLevel[];
  services: string[];
  environments: string[];
  traceIds: string[];
  hosts: string[];
  ways: string[];
  /** Lower-cased phrases that must all appear in the message. */
  text: string[];
}

const LEVEL_ALIASES: Record<string, LogLevel> = {
  warning: 'warn',
  err: 'error',
  critical: 'fatal',
};

/**
 * Parses `level:error service:checkout-api env:prod trace:4bf9 host:h way:drain "exact phrase" word`.
 * Comma-separated values are alternatives (`level:error,fatal`). Unknown keys and invalid levels
 * stay as text, never silently dropped. Same syntax as the web app's search box.
 */
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
  for (const raw of input.match(/"[^"]*"|\S+/g) ?? []) {
    if (raw.startsWith('"')) {
      const phrase = raw.slice(1, -1).trim();
      if (phrase) q.text.push(phrase.toLowerCase());
      continue;
    }
    const sep = raw.indexOf(':');
    const key = sep > 0 ? raw.slice(0, sep).toLowerCase() : '';
    const values =
      sep > 0
        ? raw
            .slice(sep + 1)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : [];
    if (key === 'level' && values.length) {
      const levels = values.map((v) => LEVEL_ALIASES[v.toLowerCase()] ?? v.toLowerCase());
      if (levels.every((l) => (LOG_LEVELS as readonly string[]).includes(l))) {
        q.levels.push(...(levels as LogLevel[]));
        continue;
      }
    }
    const target =
      key === 'service'
        ? q.services
        : key === 'env' || key === 'environment'
          ? q.environments
          : key === 'trace'
            ? q.traceIds
            : key === 'host'
              ? q.hosts
              : key === 'way'
                ? q.ways
                : null;
    if (target && values.length) target.push(...values.map((v) => v.toLowerCase()));
    else q.text.push(raw.toLowerCase());
  }
  return q;
}

/** Escapes `%`, `_` and `\` for ILIKE. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
