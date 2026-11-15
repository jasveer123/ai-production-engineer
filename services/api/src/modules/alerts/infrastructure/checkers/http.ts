import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import { checkOutboundUrl } from '../../../../core/common/outbound-url';
import { resolveSafe } from './resolve';
import {
  errorMessage,
  failed,
  type CheckContext,
  type CheckResult,
  type CheckTarget,
} from './types';

const MAX_REDIRECTS = 5;
const MAX_BODY = 1_000_000;
const USER_AGENT = 'Pramaan-Monitor/1.0';

interface Hop {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
  dnsMs: number;
  connectMs: number | null;
  tlsMs: number | null;
  firstByteMs: number;
}

interface HopRequest {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  readBody: boolean;
}

async function hop(req: HopRequest, target: CheckTarget, ctx: CheckContext): Promise<Hop> {
  await checkOutboundUrl(req.url.toString(), { ...ctx.policy, allowHttp: true });
  const resolved = await resolveSafe(req.url.hostname, ctx.policy, target.ipVersion);
  const lookup: LookupFunction = (_host, options, cb) =>
    options.all
      ? cb(null, [{ address: resolved.address, family: resolved.family }])
      : cb(null, resolved.address, resolved.family);
  const send = req.url.protocol === 'https:' ? httpsRequest : httpRequest;
  const started = performance.now();
  const since = () => Math.round(performance.now() - started);
  let connectMs: number | null = null;
  let tlsMs: number | null = null;
  return new Promise((resolve, reject) => {
    const r = send(req.url, {
      method: req.method,
      headers: req.headers,
      lookup,
      agent: false,
      rejectUnauthorized: target.verifyTls,
      signal: AbortSignal.timeout(target.timeoutSeconds * 1000),
    });
    r.on('socket', (socket) => {
      socket.once('connect', () => (connectMs = since()));
      socket.once('secureConnect', () => (tlsMs = since() - (connectMs ?? 0)));
    });
    r.on('response', (res) => {
      const firstByteMs = since();
      const chunks: Buffer[] = [];
      let size = 0;
      const finish = () =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
          dnsMs: resolved.dnsMs,
          connectMs,
          tlsMs,
          firstByteMs,
        });
      if (!req.readBody) {
        res.destroy();
        return finish();
      }
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size <= MAX_BODY) chunks.push(chunk);
        else res.destroy();
      });
      res.on('end', finish);
      res.on('close', finish);
      res.on('error', reject);
    });
    r.on('error', reject);
    r.end(req.body ?? undefined);
  });
}

function verdict(
  status: number,
  body: string,
  t: CheckTarget,
): { ok: boolean; error: string | null } {
  if (t.monitorKind === 'status') {
    const ok = t.expectedStatuses.includes(status);
    return {
      ok,
      error: ok ? null : `Expected HTTP ${t.expectedStatuses.join(', ')}, got ${status}`,
    };
  }
  if (status < 200 || status >= 400) return { ok: false, error: `HTTP ${status}` };
  if (t.monitorKind !== 'keyword') return { ok: true, error: null };
  const found = body.toLowerCase().includes((t.keyword ?? '').toLowerCase());
  const absent = t.keywordMode === 'absent';
  if (absent ? !found : found) return { ok: true, error: null };
  return {
    ok: false,
    error: absent ? `The page contains "${t.keyword}"` : `The page does not contain "${t.keyword}"`,
  };
}

function baseHeaders(t: CheckTarget, ctx: CheckContext): Record<string, string> {
  const headers: Record<string, string> = { 'user-agent': USER_AGENT };
  for (const h of t.headers) headers[h.name.toLowerCase()] = h.value;
  if (t.basicAuthUser)
    headers.authorization = `Basic ${Buffer.from(`${t.basicAuthUser}:${ctx.basicAuthPassword ?? ''}`).toString('base64')}`;
  return headers;
}

// shortcut: the cookie jar ignores Domain/Path/Expiry; enough for login-style redirect chains.
function storeCookies(jar: Map<string, string>, headers: IncomingHttpHeaders) {
  for (const raw of headers['set-cookie'] ?? []) {
    const [pair] = raw.split(';');
    const eq = pair!.indexOf('=');
    if (eq > 0) jar.set(pair!.slice(0, eq).trim(), pair!.slice(eq + 1).trim());
  }
}

function redirected(
  req: HopRequest,
  res: Hop,
  location: string,
  jar: Map<string, string>,
  origin: string,
): HopRequest {
  const next = new URL(location, req.url);
  const toGet =
    res.status === 303 || ((res.status === 301 || res.status === 302) && req.method === 'POST');
  const headers = { ...req.headers };
  if (next.origin !== origin) delete headers.authorization;
  if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  return {
    ...req,
    url: next,
    headers,
    method: toGet ? 'GET' : req.method,
    body: toGet ? null : req.body,
  };
}

function firstRequest(t: CheckTarget, ctx: CheckContext): HopRequest {
  const stamp = String(Math.floor(Date.now() / 1000));
  return {
    url: new URL(t.url ?? ''),
    method: t.method,
    headers: baseHeaders(t, ctx),
    body: t.body ? t.body.replaceAll('{timestamp}', stamp) : null,
    readBody: t.monitorKind === 'keyword',
  };
}

const isRedirect = (status: number) => status >= 300 && status < 400;

export async function checkHttp(t: CheckTarget, ctx: CheckContext): Promise<CheckResult> {
  const started = performance.now();
  const keepsRedirect = t.monitorKind === 'status' && t.expectedStatuses.some(isRedirect);
  const follow = t.followRedirects && !keepsRedirect;
  const jar = new Map<string, string>();
  let req = firstRequest(t, ctx);
  const origin = req.url.origin;
  try {
    for (let n = 0; ; n += 1) {
      const res = await hop(req, t, ctx);
      const location = res.headers.location;
      if (!follow || !isRedirect(res.status) || !location) {
        const { dnsMs, connectMs, tlsMs, firstByteMs } = res;
        return {
          ...verdict(res.status, res.body, t),
          statusCode: res.status,
          responseMs: Math.round(performance.now() - started),
          timings: { dnsMs, connectMs, tlsMs, firstByteMs },
        };
      }
      if (n >= MAX_REDIRECTS) return failed('Too many redirects', started, res.status);
      if (t.keepCookies) storeCookies(jar, res.headers);
      req = redirected(req, res, location, jar, origin);
    }
  } catch (err) {
    return failed(errorMessage(err), started);
  }
}
