import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { FetchFn } from '../tools/readers';
import { ProvisionError } from './provisioner-http';

/** Token exchanges for "sign in and approve" setups. Pure, with an injectable fetch. */

async function post<T>(fetchFn: FetchFn, tool: string, url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetchFn(url, { method: 'POST', ...init, signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    throw new ProvisionError(`Could not reach ${tool}: ${(err as Error).message}`);
  }
  const text = await res.text();
  if (!res.ok)
    throw new ProvisionError(
      `${tool} refused the sign-in (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  return JSON.parse(text) as T;
}

// ---------- Sentry public integration ----------

export interface SentryTokens {
  token: string;
  refreshToken: string;
  expiresAt: string;
}

export const sentryInstallUrl = (sentryUrl: string, slug: string, state: string) =>
  `${sentryUrl.replace(/\/$/, '')}/sentry-apps/${encodeURIComponent(slug)}/external-install/?state=${encodeURIComponent(state)}`;

export async function sentryExchange(
  cfg: { url: string; clientId: string; clientSecret: string },
  installationId: string,
  body:
    | { grant_type: 'authorization_code'; code: string }
    | { grant_type: 'refresh_token'; refresh_token: string },
  fetchFn: FetchFn,
): Promise<SentryTokens> {
  const r = await post<{ token: string; refreshToken: string; expiresAt: string }>(
    fetchFn,
    'Sentry',
    `${cfg.url.replace(/\/$/, '')}/api/0/sentry-app-installations/${encodeURIComponent(installationId)}/authorizations/`,
    {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, client_id: cfg.clientId, client_secret: cfg.clientSecret }),
    },
  );
  return { token: r.token, refreshToken: r.refreshToken, expiresAt: r.expiresAt };
}

/** Marks the installation installed once our side is ready ("Verify Install"). */
export async function sentryVerifyInstall(
  url: string,
  installationId: string,
  token: string,
  fetchFn: FetchFn,
) {
  const res = await fetchFn(
    `${url.replace(/\/$/, '')}/api/0/sentry-app-installations/${encodeURIComponent(installationId)}/`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'installed' }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok)
    throw new ProvisionError(`Sentry did not accept the installation (HTTP ${res.status})`);
}

/** `Sentry-Hook-Signature`: hex HMAC-SHA256 of the raw body with the client secret. */
export function verifySentrySignature(
  secret: string,
  rawBody: Buffer,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ---------- Vercel integration ----------

export const vercelInstallUrl = (slug: string, state: string) =>
  `https://vercel.com/integrations/${encodeURIComponent(slug)}/new?state=${encodeURIComponent(state)}`;

export async function vercelExchange(
  cfg: { clientId: string; clientSecret: string; redirectUri: string },
  code: string,
  fetchFn: FetchFn,
): Promise<{ accessToken: string; teamId: string | null }> {
  const r = await post<{ access_token: string; team_id?: string | null }>(
    fetchFn,
    'Vercel',
    'https://api.vercel.com/v2/oauth/access_token',
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri: cfg.redirectUri,
      }).toString(),
    },
  );
  return { accessToken: r.access_token, teamId: r.team_id ?? null };
}

// ---------- Heroku OAuth ----------

export const herokuAuthorizeUrl = (clientId: string, state: string) =>
  `https://id.heroku.com/oauth/authorize?${new URLSearchParams({ client_id: clientId, response_type: 'code', scope: 'write', state })}`;

export async function herokuExchange(
  cfg: { clientSecret: string },
  code: string,
  fetchFn: FetchFn,
) {
  const r = await post<{ access_token: string; refresh_token: string; expires_in: number }>(
    fetchFn,
    'Heroku',
    'https://id.heroku.com/oauth/token',
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_secret: cfg.clientSecret,
      }).toString(),
    },
  );
  return { accessToken: r.access_token, refreshToken: r.refresh_token, expiresIn: r.expires_in };
}

export const newSetupId = () => randomUUID();
