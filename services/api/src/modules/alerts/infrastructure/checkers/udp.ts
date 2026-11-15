import { createSocket } from 'node:dgram';
import { resolveSafe } from './resolve';
import {
  errorMessage,
  failed,
  type CheckContext,
  type CheckResult,
  type CheckTarget,
} from './types';

export async function checkUdp(target: CheckTarget, ctx: CheckContext): Promise<CheckResult> {
  const started = performance.now();
  try {
    const resolved = await resolveSafe(target.host ?? '', ctx.policy, target.ipVersion);
    const socket = createSocket(resolved.family === 6 ? 'udp6' : 'udp4');
    const reply = await new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`No reply within ${target.timeoutSeconds}s`)),
        target.timeoutSeconds * 1000,
      );
      const done = () => {
        clearTimeout(timer);
        socket.close();
      };
      socket.once('message', (msg) => {
        done();
        resolve(msg);
      });
      socket.once('error', (err) => {
        done();
        reject(err);
      });
      socket.connect(target.port ?? 0, resolved.address, () =>
        socket.send(Buffer.from(target.udpPayload ?? '', 'utf8')),
      );
    });
    const text = reply.toString('utf8');
    const ok = !target.keyword || text.toLowerCase().includes(target.keyword.toLowerCase());
    return {
      ok,
      statusCode: null,
      responseMs: Math.round(performance.now() - started),
      error: ok ? null : `The reply does not contain "${target.keyword}"`,
      timings: { dnsMs: resolved.dnsMs, connectMs: null, tlsMs: null, firstByteMs: null },
    };
  } catch (err) {
    return failed(errorMessage(err), started);
  }
}
