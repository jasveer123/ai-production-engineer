import { connect } from 'node:net';
import { checkOutboundUrl, type OutboundPolicy } from '../../../core/common/outbound-url';

export interface MonitorTarget {
  monitorKind: 'http' | 'keyword' | 'status' | 'tcp';
  url?: string | null;
  host?: string | null;
  port?: number | null;
  expectedStatus?: number | null;
  keyword?: string | null;
  keywordMode?: 'present' | 'absent';
  timeoutSeconds: number;
}

export interface CheckResult {
  ok: boolean;
  statusCode: number | null;
  responseMs: number;
  error: string | null;
}

const MAX_REDIRECTS = 5;
const MAX_BODY = 1_000_000;
const USER_AGENT = 'Pramaan-Monitor/1.0';

function message(error: unknown): string {
  const e = error as { name?: string; message?: string; cause?: { code?: string } };
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'Timed out';
  return e?.cause?.code ?? e?.message ?? 'Request failed';
}

async function fetchFollowing(
  url: string,
  target: MonitorTarget,
  policy: OutboundPolicy,
  follow: boolean,
): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await checkOutboundUrl(current, { ...policy, allowHttp: true });
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(target.timeoutSeconds * 1000),
    });
    const location = res.headers.get('location');
    if (!follow || res.status < 300 || res.status >= 400 || !location) return res;
    await res.body?.cancel();
    current = new URL(location, current).toString();
  }
  throw new Error('Too many redirects');
}

function verdict(
  status: number,
  body: string,
  target: MonitorTarget,
): { ok: boolean; error: string | null } {
  if (target.monitorKind === 'status') {
    const ok = status === target.expectedStatus;
    return { ok, error: ok ? null : `Expected HTTP ${target.expectedStatus}, got ${status}` };
  }
  if (status < 200 || status >= 400) return { ok: false, error: `HTTP ${status}` };
  if (target.monitorKind !== 'keyword') return { ok: true, error: null };
  const found = body.toLowerCase().includes((target.keyword ?? '').toLowerCase());
  const absent = target.keywordMode === 'absent';
  if (absent ? !found : found) return { ok: true, error: null };
  return {
    ok: false,
    error: absent
      ? `The page contains "${target.keyword}"`
      : `The page does not contain "${target.keyword}"`,
  };
}

async function checkHttp(target: MonitorTarget, policy: OutboundPolicy): Promise<CheckResult> {
  const started = Date.now();
  const expected = target.expectedStatus ?? 0;
  const follow = !(expected >= 300 && expected < 400);
  try {
    const res = await fetchFollowing(target.url ?? '', target, policy, follow);
    let body = '';
    if (target.monitorKind === 'keyword') body = (await res.text()).slice(0, MAX_BODY);
    else await res.body?.cancel();
    return {
      ...verdict(res.status, body, target),
      statusCode: res.status,
      responseMs: Date.now() - started,
    };
  } catch (err) {
    return { ok: false, statusCode: null, responseMs: Date.now() - started, error: message(err) };
  }
}

async function checkTcp(target: MonitorTarget, policy: OutboundPolicy): Promise<CheckResult> {
  const started = Date.now();
  const host = target.host ?? '';
  try {
    await checkOutboundUrl(`https://${host.includes(':') ? `[${host}]` : host}`, policy);
  } catch (err) {
    return { ok: false, statusCode: null, responseMs: 0, error: (err as Error).message };
  }
  return new Promise((resolve) => {
    const socket = connect({ host, port: target.port ?? 0 });
    const finish = (ok: boolean, error: string | null) => {
      socket.destroy();
      resolve({ ok, statusCode: null, responseMs: Date.now() - started, error });
    };
    socket.setTimeout(target.timeoutSeconds * 1000, () => finish(false, 'Timed out'));
    socket.once('connect', () => finish(true, null));
    socket.once('error', (err: NodeJS.ErrnoException) => finish(false, err.code ?? err.message));
  });
}

export function checkMonitor(target: MonitorTarget, policy: OutboundPolicy): Promise<CheckResult> {
  return target.monitorKind === 'tcp' ? checkTcp(target, policy) : checkHttp(target, policy);
}
