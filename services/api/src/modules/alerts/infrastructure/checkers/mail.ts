import { MAIL_DEFAULT_PORTS } from '@ape/api-contracts';
import { openSocket } from './tcp';
import {
  errorMessage,
  failed,
  type CheckContext,
  type CheckResult,
  type CheckTarget,
} from './types';

type MailKind = keyof typeof MAIL_DEFAULT_PORTS;

const PROTOCOL: Record<MailKind, { greeting: RegExp; bye: string; tlsPorts: number[] }> = {
  smtp: { greeting: /^220[ -]/, bye: 'QUIT\r\n', tlsPorts: [465] },
  pop3: { greeting: /^\+OK/, bye: 'QUIT\r\n', tlsPorts: [995] },
  imap: { greeting: /^\* (OK|PREAUTH)/i, bye: 'a1 LOGOUT\r\n', tlsPorts: [993] },
};

export async function checkMail(target: CheckTarget, ctx: CheckContext): Promise<CheckResult> {
  const kind = target.monitorKind as MailKind;
  const proto = PROTOCOL[kind];
  const port = target.port ?? MAIL_DEFAULT_PORTS[kind];
  const started = performance.now();
  try {
    const opened = await openSocket(target, ctx, port, proto.tlsPorts.includes(port));
    const { socket } = opened;
    const greeting = await new Promise<string>((resolve, reject) => {
      let buffer = '';
      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        if (buffer.includes('\n') || buffer.length > 1024) resolve(buffer.split(/\r?\n/)[0]!);
      });
      socket.once('timeout', () => reject(new Error('No greeting before the timeout')));
      socket.once('error', reject);
      socket.once('end', () => reject(new Error('Server closed the connection')));
    });
    const firstByteMs = Math.round(performance.now() - started);
    socket.end(proto.bye);
    const ok = proto.greeting.test(greeting);
    return {
      ok,
      statusCode: null,
      responseMs: firstByteMs,
      error: ok ? null : `Unexpected greeting: ${greeting.slice(0, 120)}`,
      timings: { dnsMs: opened.dnsMs, connectMs: opened.connectMs, tlsMs: null, firstByteMs },
    };
  } catch (err) {
    return failed(errorMessage(err), started);
  }
}
