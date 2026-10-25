import type { ApiError as ApiErrorBody } from '@ape/api-contracts';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  /** Quote this to support; it finds the request in the server logs. */
  readonly correlationId: string | null;

  constructor(status: number, body: Partial<ApiErrorBody>, headerCorrelationId?: string | null) {
    super(body.message ?? `Request failed (${status})`);
    this.status = status;
    this.code = body.code ?? 'error';
    this.details = body.details;
    this.correlationId = body.correlationId ?? headerCorrelationId ?? null;
  }
}

/** Fetch wrapper: sends the session cookie, parses JSON, and turns error responses into ApiError. */
export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...rest.headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, {
      code: 'network',
      message: 'Could not reach the server. Check your connection and try again.',
    });
  }
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok)
    throw new ApiError(
      res.status,
      (body ?? {}) as Partial<ApiErrorBody>,
      res.headers.get('x-correlation-id'),
    );
  return body as T;
}

export const apiUrl = (path: string) => `${API_URL}${path}`;

/** The correlation id of a failed API call, when there is one. */
export function correlationIdOf(err: unknown): string | null {
  return err instanceof ApiError ? err.correlationId : null;
}

/** A user-facing message for any thrown value. */
export function errorMessage(err: unknown): string {
  // Server faults carry the reference so a screenshot of the banner is enough for support.
  if (err instanceof ApiError)
    return err.status >= 500 && err.correlationId
      ? `${err.message} (reference ${err.correlationId})`
      : err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Try again.';
}
