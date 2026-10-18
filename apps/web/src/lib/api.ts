import type { ApiError as ApiErrorBody } from '@ape/api-contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

/** Fetch wrapper: sends the session cookie and turns error responses into ApiError. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(res.status, {
      code: err.code ?? 'error',
      message: err.message ?? `Request failed (${res.status})`,
      correlationId: err.correlationId ?? 'unknown',
      details: err.details,
    });
  }
  return body as T;
}

export const apiUrl = (path: string) => `${API_URL}${path}`;
