import { Resolver } from 'node:dns/promises';
import { isPrivateAddress } from '../../../../core/common/outbound-url';
import {
  errorMessage,
  failed,
  type CheckContext,
  type CheckResult,
  type CheckTarget,
} from './types';

async function query(
  resolver: Resolver,
  name: string,
  type: CheckTarget['dnsRecordType'],
): Promise<string[]> {
  switch (type) {
    case 'A':
      return resolver.resolve4(name);
    case 'AAAA':
      return resolver.resolve6(name);
    case 'CNAME':
      return resolver.resolveCname(name);
    case 'NS':
      return resolver.resolveNs(name);
    case 'MX':
      return (await resolver.resolveMx(name)).map((r) => `${r.priority} ${r.exchange}`);
    case 'TXT':
      return (await resolver.resolveTxt(name)).map((r) => r.join(''));
  }
}

export async function checkDns(target: CheckTarget, ctx: CheckContext): Promise<CheckResult> {
  const started = performance.now();
  const server = target.host ?? '';
  if (!ctx.policy.allowPrivate && isPrivateAddress(server))
    return failed('The DNS server is a private or internal address', started);
  try {
    const resolver = new Resolver({ timeout: target.timeoutSeconds * 1000, tries: 1 });
    const port = target.port ?? 53;
    resolver.setServers([server.includes(':') ? `[${server}]:${port}` : `${server}:${port}`]);
    const answers = await query(resolver, target.dnsDomain ?? '', target.dnsRecordType);
    const expected = target.dnsExpected?.toLowerCase();
    const ok =
      answers.length > 0 && (!expected || answers.some((a) => a.toLowerCase().includes(expected)));
    const responseMs = Math.round(performance.now() - started);
    return {
      ok,
      statusCode: null,
      responseMs,
      error: ok
        ? null
        : answers.length
          ? `Expected "${target.dnsExpected}", got ${answers.slice(0, 3).join(', ').slice(0, 200)}`
          : 'No records returned',
      timings: { dnsMs: responseMs, connectMs: null, tlsMs: null, firstByteMs: null },
    };
  } catch (err) {
    return failed(errorMessage(err), started);
  }
}
