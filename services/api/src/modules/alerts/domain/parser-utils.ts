import { createHash } from 'node:crypto';
import type { Severity } from '@ape/api-contracts';
import { PermanentIngestError } from '../../../ingest/ingestion/domain/normalize';

const MAX_LABELS = 50;

export const prim = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';

export const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);

export function mapSeverity(raw: unknown): Severity {
  const v = prim(raw).trim().toLowerCase();
  if (['critical', 'crit', 'fatal', 'emergency', 'p1', 'sev1', 'page', 'disaster'].includes(v))
    return 'critical';
  if (['high', 'error', 'err', 'major', 'p2', 'sev2', 'alert'].includes(v)) return 'high';
  if (['warning', 'warn', 'medium', 'moderate', 'p3', 'sev3', 'average'].includes(v))
    return 'medium';
  if (['info', 'information', 'low', 'minor', 'p4', 'p5', 'sev4', 'debug', 'ok'].includes(v))
    return 'low';
  return 'medium';
}

export function flatten(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_LABELS) break;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      out[k.slice(0, 100)] = String(v).slice(0, 500);
  }
  return out;
}

export const date = (v: unknown, fallback: Date): Date => {
  if (typeof v !== 'string' && typeof v !== 'number') return fallback;
  const d = new Date(v);

  return Number.isNaN(d.getTime()) ||
    d.getFullYear() < 2000 ||
    d.getTime() > fallback.getTime() + 3600_000
    ? fallback
    : d;
};

export const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

export const url = (v: unknown): string | null => {
  const s = text(v, 2000);
  return s && /^https?:\/\//i.test(s) ? s : null;
};

export const invalid = (message: string) => new PermanentIngestError('invalid_payload', message);

export const firstText = (max: number, ...values: unknown[]): string | null => {
  for (const v of values) {
    const t = text(v, max);
    if (t !== null) return t;
  }
  return null;
};

export function tagLabels(tags: string[]): Record<string, string> {
  return Object.fromEntries(
    tags.map((t) => {
      const i = t.indexOf(':');
      return i > 0 ? [t.slice(0, i), t.slice(i + 1)] : [t, 'true'];
    }),
  );
}

export const splitTags = (v: unknown): string[] =>
  prim(v)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

export const firstDefined = (values: unknown[]): unknown => values.find((v) => v != null);

export const pick = (source: Record<string, unknown>, ...keys: string[]): unknown =>
  firstDefined(keys.map((k) => source[k]));
