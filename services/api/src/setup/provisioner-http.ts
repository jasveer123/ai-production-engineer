import type { FetchFn } from '../tools/readers';

export class ProvisionError extends Error {}

const TIMEOUT = 15_000;

export async function call<T>(
  fetchFn: FetchFn,
  tool: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), redirect: 'error' });
  } catch (err) {
    throw new ProvisionError(`Could not reach ${tool}: ${(err as Error).message}`);
  }
  const text = await res.text();
  if (res.status === 401 || res.status === 403)
    throw new ProvisionError(
      `${tool} rejected the key (HTTP ${res.status}). It needs admin rights for the one-time setup.`,
    );
  if (!res.ok)
    throw new ProvisionError(`${tool} answered HTTP ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

export const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
export const base = (u: string) => u.replace(/\/+$/, '');
