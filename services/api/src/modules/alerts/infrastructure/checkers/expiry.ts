import { connect } from 'node:tls';
import { isIP } from 'node:net';
import type { OutboundPolicy } from '../../../../core/common/outbound-url';
import { resolveSafe } from './resolve';

const RDAP_BASE = 'https://rdap.org/domain/';

export async function certificateExpiry(
  url: string,
  policy: OutboundPolicy,
  timeoutSeconds: number,
): Promise<Date> {
  const target = new URL(url);
  const resolved = await resolveSafe(target.hostname, policy, 'any');
  return new Promise((resolve, reject) => {
    const socket = connect({
      host: resolved.address,
      port: Number(target.port || 443),
      servername: isIP(target.hostname) ? undefined : target.hostname,
      rejectUnauthorized: false,
    });
    socket.setTimeout(timeoutSeconds * 1000, () => {
      socket.destroy();
      reject(new Error('Timed out reading the certificate'));
    });
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert?.valid_to) reject(new Error('The server sent no certificate'));
      else resolve(new Date(cert.valid_to));
    });
    socket.once('error', reject);
  });
}

interface RdapDomain {
  events?: { eventAction?: string; eventDate?: string }[];
}

// RDAP needs the registered domain; we walk up from the most specific candidate that a registry knows.
export async function domainExpiry(host: string): Promise<Date | null> {
  if (isIP(host)) return null;
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  for (let take = 2; take <= labels.length; take += 1) {
    const domain = labels.slice(-take).join('.');
    const res = await fetch(`${RDAP_BASE}${encodeURIComponent(domain)}`, {
      headers: { accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`RDAP lookup failed (HTTP ${res.status})`);
    const data = (await res.json()) as RdapDomain;
    const expiry = data.events?.find((e) => e.eventAction === 'expiration')?.eventDate;
    return expiry ? new Date(expiry) : null;
  }
  return null;
}
