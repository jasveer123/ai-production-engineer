import { execFile } from 'node:child_process';
import { isIP } from 'node:net';
import { resolveSafe } from './resolve';
import {
  errorMessage,
  failed,
  type CheckContext,
  type CheckResult,
  type CheckTarget,
} from './types';

function pingCommand(address: string, family: 4 | 6, timeoutSeconds: number): [string, string[]] {
  const wait = String(Math.max(1, Math.min(timeoutSeconds, 60)));
  if (process.platform === 'darwin')
    return family === 6
      ? ['ping6', ['-n', '-c', '1', address]]
      : ['ping', ['-n', '-c', '1', '-t', wait, address]];
  return ['ping', [family === 6 ? '-6' : '-4', '-n', '-c', '1', '-W', wait, address]];
}

export async function checkPing(target: CheckTarget, ctx: CheckContext): Promise<CheckResult> {
  const started = performance.now();
  try {
    const resolved = await resolveSafe(target.host ?? '', ctx.policy, target.ipVersion);
    if (!isIP(resolved.address)) return failed('Could not resolve the host', started);
    const [bin, args] = pingCommand(resolved.address, resolved.family, target.timeoutSeconds);
    const output = await new Promise<string>((resolve, reject) =>
      execFile(bin, args, { timeout: (target.timeoutSeconds + 1) * 1000 }, (err, stdout) => {
        if (!err) return resolve(stdout);
        const e = err as NodeJS.ErrnoException & { killed?: boolean };
        if (e.code === 'ENOENT')
          return reject(new Error('The ping binary is not installed on this probe'));
        reject(new Error(e.killed ? 'Timed out' : 'No ICMP reply'));
      }),
    );
    const rtt = /time[=<]([\d.]+)\s*ms/.exec(output)?.[1];
    return {
      ok: true,
      statusCode: null,
      responseMs: rtt ? Math.round(Number(rtt)) : Math.round(performance.now() - started),
      error: null,
      timings: { dnsMs: resolved.dnsMs, connectMs: null, tlsMs: null, firstByteMs: null },
    };
  } catch (err) {
    return failed(errorMessage(err), started);
  }
}
