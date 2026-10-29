export interface ReaderQuery {
  service: string | null;
  environment: string | null;
  from: Date;
  to: Date;
  limit: number;

  errorsOnly?: boolean;
}

export type ReaderConfig = { settings: Record<string, string>; secrets: Record<string, string> };

export type FetchFn = typeof fetch;

export class ReaderError extends Error {}

const TIMEOUT_MS = 10_000;

export async function call(
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
    return body
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as unknown);
  }
}

export const asText = (v: unknown): string =>
  typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : JSON.stringify(v);

export const trimBase = (u: string) => u.replace(/\/+$/, '');
export const basic = (user: string, pass: string) =>
  `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const LEVEL_WORDS = /\b(fatal|panic|critical|error|err|exception|warn(?:ing)?|info|debug)\b/i;
export const guessLevel = (line: string, fallback = 'info') =>
  LEVEL_WORDS.exec(line)?.[1]
    ?.toLowerCase()
    .replace(/^err$/, 'error')
    .replace('warning', 'warn')
    .replace('exception', 'error') ?? fallback;
