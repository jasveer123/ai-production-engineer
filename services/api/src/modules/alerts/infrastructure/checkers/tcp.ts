import { connect, type Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import { resolveSafe } from './resolve';
import {
  errorMessage,
  failed,
  type CheckContext,
  type CheckResult,
  type CheckTarget,
} from './types';

export interface OpenedSocket {
  socket: Socket;
  started: number;
  dnsMs: number;
  connectMs: number;
}

export async function openSocket(
  target: CheckTarget,
  ctx: CheckContext,
  port: number,
  tls: boolean,
): Promise<OpenedSocket> {
  const started = performance.now();
  const host = target.host ?? '';
  const resolved = await resolveSafe(host, ctx.policy, target.ipVersion);
  return new Promise((resolve, reject) => {
    const options = { host: resolved.address, port, family: resolved.family };
    const socket = tls
      ? tlsConnect({ ...options, servername: host, rejectUnauthorized: target.verifyTls })
      : connect(options);
    socket.setTimeout(target.timeoutSeconds * 1000, () => {
      socket.destroy();
      reject(new Error('Timed out'));
    });
    socket.once(tls ? 'secureConnect' : 'connect', () =>
      resolve({
        socket,
        started,
        dnsMs: resolved.dnsMs,
        connectMs: Math.round(performance.now() - started) - resolved.dnsMs,
      }),
    );
    socket.once('error', reject);
  });
}

export async function checkTcp(target: CheckTarget, ctx: CheckContext): Promise<CheckResult> {
  const started = performance.now();
  try {
    const opened = await openSocket(target, ctx, target.port ?? 0, false);
    opened.socket.destroy();
    return {
      ok: true,
      statusCode: null,
      responseMs: Math.round(performance.now() - started),
      error: null,
      timings: { dnsMs: opened.dnsMs, connectMs: opened.connectMs, tlsMs: null, firstByteMs: null },
    };
  } catch (err) {
    return failed(errorMessage(err), started);
  }
}
