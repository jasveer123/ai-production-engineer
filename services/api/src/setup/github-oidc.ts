import { createPublicKey, createVerify, type JsonWebKey } from 'node:crypto';

export const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
const JWKS_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_S = 60;

export interface GitHubOidcClaims {
  iss: string;
  aud: string | string[];
  exp: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  sub: string;
  /** "owner/repo" */
  repository: string;
  ref?: string;
  sha?: string;
  run_id?: string;
  workflow?: string;
  actor?: string;
}

export class OidcError extends Error {}

type Jwk = JsonWebKey & { kid?: string };
export type JwksFetcher = () => Promise<Jwk[]>;

let cache: { keys: Jwk[]; at: number } | null = null;

export const fetchGitHubJwks: JwksFetcher = async () => {
  if (cache && Date.now() - cache.at < JWKS_TTL_MS) return cache.keys;
  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new OidcError(`Could not load GitHub signing keys (HTTP ${res.status})`);
  const body = (await res.json()) as { keys: Jwk[] };
  cache = { keys: body.keys, at: Date.now() };
  return body.keys;
};

const b64url = (s: string) => Buffer.from(s, 'base64url');

/**
 * Verifies a GitHub Actions OIDC token: RS256 signature against GitHub's published keys, issuer,
 * audience and time. The `repository` claim then says exactly which repo the workflow ran in, so
 * a deploy marker needs no shared secret.
 */
export async function verifyGitHubOidc(
  token: string,
  audience: string,
  jwks: JwksFetcher = fetchGitHubJwks,
  nowS = Math.floor(Date.now() / 1000),
): Promise<GitHubOidcClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new OidcError('Not a JWT');
  const [h, p, sig] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let claims: GitHubOidcClaims;
  try {
    header = JSON.parse(b64url(h).toString('utf8')) as typeof header;
    claims = JSON.parse(b64url(p).toString('utf8')) as GitHubOidcClaims;
  } catch {
    throw new OidcError('Malformed token');
  }
  if (header.alg !== 'RS256') throw new OidcError('Unexpected signing algorithm');
  const key = (await jwks()).find((k) => k.kid === header.kid);
  if (!key) throw new OidcError('Unknown signing key');
  const ok = createVerify('RSA-SHA256')
    .update(`${h}.${p}`)
    .verify(createPublicKey({ key, format: 'jwk' }), b64url(sig));
  if (!ok) throw new OidcError('Bad signature');
  if (claims.iss !== GITHUB_OIDC_ISSUER) throw new OidcError('Wrong issuer');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(audience)) throw new OidcError('Wrong audience');
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < nowS)
    throw new OidcError('Token expired');
  if (claims.nbf && claims.nbf - CLOCK_SKEW_S > nowS) throw new OidcError('Token not yet valid');
  if (!/^[\w.-]+\/[\w.-]+$/.test(claims.repository ?? ''))
    throw new OidcError('Missing repository claim');
  return claims;
}
