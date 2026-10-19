import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard for user-supplied webhook URLs (ADR-020). In production a notification may only go
 * to a public HTTPS address; the host is resolved at send time, so a DNS change to an internal
 * address is caught too. Redirects are never followed (see the sender).
 */
export class UnsafeUrlError extends Error {}

const V4_PRIVATE: [number, number][] = [
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10/8
  [0x64400000, 10], // 100.64/10 (carrier-grade NAT)
  [0x7f000000, 8], // 127/8
  [0xa9fe0000, 16], // 169.254/16 (link-local, cloud metadata)
  [0xac100000, 12], // 172.16/12
  [0xc0a80000, 16], // 192.168/16
  [0xc6120000, 15], // 198.18/15 (benchmarking)
  [0xe0000000, 3], // 224/3 (multicast, reserved)
];

function v4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, p) => (acc << 8) + Number(p), 0) >>> 0;
}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const n = v4ToInt(ip);
    return V4_PRIVATE.some(([base, bits]) => n >>> (32 - bits) === base >>> (32 - bits));
  }
  const v6 = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped) return isPrivateAddress(mapped[1]!);
  return (
    v6 === '::' ||
    v6 === '::1' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    /^fe[89ab]/.test(v6)
  );
}

export interface OutboundPolicy {
  /** Development and tests may post to local receivers (http, private addresses). */
  allowPrivate: boolean;
  resolve?: (host: string) => Promise<string[]>;
}

const defaultResolve = async (host: string) =>
  (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

export async function checkOutboundUrl(raw: string, policy: OutboundPolicy): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Not a valid URL');
  }
  if (url.username || url.password)
    throw new UnsafeUrlError('Credentials in the URL are not allowed');
  if (url.protocol !== 'https:' && !(policy.allowPrivate && url.protocol === 'http:')) {
    throw new UnsafeUrlError('Webhook URLs must use https');
  }
  if (policy.allowPrivate) return url;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : await (policy.resolve ?? defaultResolve)(host);
  if (addresses.length === 0) throw new UnsafeUrlError(`${host} does not resolve`);
  if (addresses.some(isPrivateAddress)) {
    throw new UnsafeUrlError(`${host} resolves to a private or internal address`);
  }
  return url;
}
