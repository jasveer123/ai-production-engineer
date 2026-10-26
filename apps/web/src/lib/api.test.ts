import { afterEach, describe, expect, test, vi } from 'vitest';
import { api, ApiError, correlationIdOf, errorMessage } from './api';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  test('sends the session cookie and a JSON body, and returns the parsed response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api('/things', { method: 'POST', json: { a: 1 } })).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/things$/);
    expect(init.credentials).toBe('include');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  test('204 answers resolve to undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(api('/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  test('error responses become ApiError with code, message and correlation id', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json(
            { code: 'forbidden', message: 'Not allowed', correlationId: 'abc-12345678' },
            { status: 403 },
          ),
        ),
    );

    const err = await api('/x').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'forbidden', correlationId: 'abc-12345678' });
    expect(correlationIdOf(err)).toBe('abc-12345678');
  });

  test('falls back to the response header when the body has no correlation id', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json(
            { message: 'boom' },
            { status: 500, headers: { 'x-correlation-id': 'from-header-1' } },
          ),
        ),
    );
    const err = await api('/x').catch((e: unknown) => e);
    expect(correlationIdOf(err)).toBe('from-header-1');
  });

  test('a network failure is a friendly ApiError with status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await api('/x').catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 0, code: 'network' });
  });
});

describe('errorMessage', () => {
  test('server faults carry the reference; client errors do not', () => {
    expect(errorMessage(new ApiError(500, { message: 'Oops', correlationId: 'ref-1234567' }))).toBe(
      'Oops (reference ref-1234567)',
    );
    expect(errorMessage(new ApiError(400, { message: 'Bad input', correlationId: 'ref-1' }))).toBe(
      'Bad input',
    );
  });

  test('unknown values get a generic message', () => {
    expect(errorMessage('nope')).toBe('Something went wrong. Try again.');
  });
});
