import { createHash } from 'node:crypto';
import type { SentryOccurrence } from './sentry-event';

export const FINGERPRINT_VERSION = 2;
const TOP_FRAMES = 5;

const normalizeText = (s: string) =>
  s
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/0x[0-9a-f]+/gi, '<hex>')
    .replace(/\d+/g, '<n>')
    .slice(0, 300);

const normalizeFile = (file: string | null) =>
  (file ?? '')
    .split(/[?#]/)[0]!
    .replace(/^[a-z]+:\/\/[^/]+/i, '')
    .replace(/[.-][0-9a-f]{8,}(?=\.)/gi, '')
    .replace(/\d+/g, '<n>');

export function defaultComponents(o: SentryOccurrence): string[] {
  const main = o.exceptions[o.exceptions.length - 1];
  if (!main) return [o.errorType, normalizeText(o.message)];
  const frames = main.frames.some((f) => f.inApp)
    ? main.frames.filter((f) => f.inApp)
    : main.frames;
  const top = frames.slice(-TOP_FRAMES).map((f) => `${f.function ?? '?'}@${normalizeFile(f.file)}`);
  return top.length ? [main.type, ...top] : [main.type, normalizeText(main.value)];
}

export function fingerprintOf(applicationId: string, o: SentryOccurrence): string {
  const base = defaultComponents(o);
  const parts = o.fingerprint
    ? o.fingerprint.flatMap((p) => (/^\{\{\s*default\s*\}\}$/.test(p) ? base : [p]))
    : base;
  return `v${FINGERPRINT_VERSION}:${createHash('sha256')
    .update([applicationId, ...parts].join('\n'))
    .digest('hex')
    .slice(0, 40)}`;
}

function versionParts(release: string): number[] | null {
  const version = release.includes('@') ? release.slice(release.lastIndexOf('@') + 1) : release;
  const match = /^v?(\d+(?:\.\d+){0,3})(?:[-+].*)?$/.exec(version.trim());
  return match ? match[1]!.split('.').map(Number) : null;
}

export function compareReleases(a: string, b: string): number | null {
  if (a === b) return 0;
  const x = versionParts(a);
  const y = versionParts(b);
  if (!x || !y) return null;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

export function isRegression(
  resolvedIn: string | null,
  eventRelease: string | null,
  firstSeen: (release: string) => Date | null,
): boolean {
  if (!resolvedIn || !eventRelease) return true;
  const order = compareReleases(eventRelease, resolvedIn);
  if (order !== null) return order >= 0;
  const eventAt = firstSeen(eventRelease);
  const resolvedAt = firstSeen(resolvedIn);
  if (!eventAt || !resolvedAt) return true;
  return eventAt.getTime() >= resolvedAt.getTime();
}
