import { connect } from 'node:net';

export interface TcpTarget {
  host: string;
  port: number;
  send?: string;
  expect?: RegExp;
}

export function tcpProbe(target: TcpTarget, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: target.host, port: target.port });
    const done = (err?: Error) => {
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };
    socket.setTimeout(timeoutMs, () => done(new Error(`timed out after ${timeoutMs} ms`)));
    socket.once('error', (err) => done(err));
    socket.once('connect', () => {
      if (!target.send) return done();
      socket.write(target.send);
    });
    let reply = '';
    socket.on('data', (chunk: Buffer) => {
      reply += chunk.toString('utf8');
      if (!target.expect || target.expect.test(reply)) return done();
      if (/^-/m.test(reply)) done(new Error(reply.trim().slice(0, 200)));
    });
  });
}

export function redisTarget(url: string): TcpTarget {
  const u = new URL(url);
  const auth = u.password
    ? `AUTH ${u.username ? `${decodeURIComponent(u.username)} ` : ''}${decodeURIComponent(u.password)}\r\n`
    : '';
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    send: `${auth}PING\r\n`,
    expect: /\+PONG/,
  };
}

export function hostPort(address: string, defaultPort: number): TcpTarget {
  const i = address.lastIndexOf(':');
  return i > 0
    ? { host: address.slice(0, i), port: Number(address.slice(i + 1)) }
    : { host: address, port: defaultPort };
}
