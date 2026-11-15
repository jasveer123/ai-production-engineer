import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { CheckTarget } from './types';
import {
  isPrivateAddress,
  UnsafeUrlError,
  type OutboundPolicy,
} from '../../../../core/common/outbound-url';

export interface ResolvedHost {
  address: string;
  family: 4 | 6;
  dnsMs: number;
}

// Checks connect to the vetted address itself so a second DNS answer cannot redirect them inward.
export async function resolveSafe(
  host: string,
  policy: OutboundPolicy,
  ipVersion: CheckTarget['ipVersion'],
): Promise<ResolvedHost> {
  const bare = host.replace(/^\[|\]$/g, '');
  const started = performance.now();
  const literal = isIP(bare);
  const family = ipVersion === 'v4' ? 4 : ipVersion === 'v6' ? 6 : 0;
  const answers = literal
    ? [{ address: bare, family: literal }]
    : await lookup(bare, { all: true, family, verbatim: true });
  const pick = answers.find((a) => !family || a.family === family);
  if (!pick) throw new UnsafeUrlError(`${bare} has no IPv${family || ''} address`);
  if (!policy.allowPrivate && answers.some((a) => isPrivateAddress(a.address)))
    throw new UnsafeUrlError(`${bare} resolves to a private or internal address`);
  return {
    address: pick.address,
    family: pick.family === 6 ? 6 : 4,
    dnsMs: Math.round(performance.now() - started),
  };
}
