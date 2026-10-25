import assert from 'node:assert/strict';
import { createServer, type IncomingMessage } from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import { gunzipSync } from 'node:zlib';
import * as agent from '../dist/esm/index.js';
import { redactText, redactValue } from '../dist/esm/redact.js';
import { Transport } from '../dist/esm/transport.js';

type Received = { path: string; headers: IncomingMessage['headers']; body: unknown[] };
const received: Received[] = [];
let status = 202;
let url = '';

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    let buf = Buffer.concat(chunks);
    if (req.headers['content-encoding'] === 'gzip') buf = gunzipSync(buf);
    received.push({
      path: req.url ?? '',
      headers: req.headers,
      body: JSON.parse(buf.toString()) as unknown[],
    });
    res.statusCode = status;
    res.end();
  });
});

before(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address() as { port: number };
  url = `http://127.0.0.1:${addr.port}`;
});
after(() => server.close());
beforeEach(() => {
  received.length = 0;
  status = 202;
});

describe('agent', () => {
  before(() => {
    const ok = agent.start({
      token: 'ape_live_test',
      endpoint: url,
      service: 'shop',
      environment: 'test',
      tracing: false,
      captureUncaught: false,
      debug: false,
      flushIntervalMs: 50,
    });
    assert.equal(ok, true);
  });
  after(() => agent.shutdown());

  it('sends console output as redacted logs with service and level', async () => {
    console.warn('card 4111 1111 1111 1111 declined for', { password: 'hunter2' });
    agent.log('info', 'hello', { orderId: 7, apiKey: 'abc' });
    await agent.flush();
    const logs = received.filter((r) => r.path === '/v1/logs').flatMap((r) => r.body) as Record<
      string,
      unknown
    >[];
    const warn = logs.find((l) => l.level === 'warn')!;
    assert.match(String(warn.message), /\[REDACTED:card_number\]/);
    assert.doesNotMatch(String(warn.message), /hunter2/);
    assert.equal(warn.service, 'shop');
    const info = logs.find((l) => l.message === 'hello')!;
    assert.equal(info.orderId, 7);
    assert.equal(info.apiKey, '[REDACTED:secret]');
    assert.equal(received[0]!.headers.authorization, 'Bearer ape_live_test');
    assert.equal(received[0]!.headers['x-ape-sdk'], `node/${agent.VERSION}`);
  });

  it('captures exceptions with type, stack and context', async () => {
    const id = agent.captureException(new TypeError('x is null'), {
      route: '/cart',
      method: 'POST',
      statusCode: 500,
      userId: 'u1',
    });
    await agent.flush();
    const errors = received.filter((r) => r.path === '/v1/errors').flatMap((r) => r.body) as Record<
      string,
      unknown
    >[];
    assert.equal(errors.length, 1);
    assert.equal(errors[0]!.event_id, id);
    assert.equal(errors[0]!.type, 'TypeError');
    assert.equal(errors[0]!.route, '/cart');
    assert.match(String(errors[0]!.stack), /agent\.test\.mts/);
    assert.deepEqual(errors[0]!.context, { userId: 'u1' });
  });

  it('Express middleware reports 5xx errors and passes them on', async () => {
    let passed: unknown;
    agent.errorHandler()(
      new Error('db down'),
      { method: 'GET', baseUrl: '/api', route: { path: '/orders/:id' } },
      {},
      (e) => (passed = e),
    );
    agent.errorHandler()(
      Object.assign(new Error('not found'), { status: 404 }),
      { method: 'GET', url: '/x' },
      {},
      () => undefined,
    );
    await agent.flush();
    const errors = received.flatMap((r) => r.body) as Record<string, unknown>[];
    assert.equal(errors.length, 1);
    assert.equal(errors[0]!.route, '/api/orders/:id');
    assert.ok(passed instanceof Error);
  });
});

describe('transport', () => {
  it('retries 5xx then succeeds; stops after 401', async () => {
    let calls = 0;
    const warnings: string[] = [];
    const fakeFetch = (async () => {
      calls++;
      return new Response(null, { status: calls === 1 ? 503 : calls === 2 ? 202 : 401 });
    }) as typeof fetch;
    const t = new Transport({
      endpoint: 'http://x',
      token: 't',
      batchSize: 10,
      flushIntervalMs: 10,
      maxQueue: 5,
      sdkHeader: 'node/test',
      warn: (m) => warnings.push(m),
      fetch: fakeFetch,
    });
    t.enqueue('logs', { a: 1 });
    await t.flush();
    assert.equal(calls, 2);
    t.enqueue('logs', { a: 2 });
    await t.flush();
    assert.match(warnings.join(), /rejected \(401\)/);
    t.enqueue('logs', { a: 3 });
    await t.flush();
    assert.equal(calls, 3);
  });

  it('keeps the queue bounded', () => {
    const warnings: string[] = [];
    const t = new Transport({
      endpoint: 'http://x',
      token: 't',
      batchSize: 1000,
      flushIntervalMs: 60_000,
      maxQueue: 3,
      sdkHeader: 's',
      warn: (m) => warnings.push(m),
      fetch: (async () => new Response(null)) as typeof fetch,
    });
    for (let i = 0; i < 6; i++) t.enqueue('logs', i);
    assert.equal(t.droppedCount, 3);
    assert.equal(warnings.length, 1);
  });
});

describe('redaction', () => {
  it('removes tokens and credentials', () => {
    assert.equal(
      redactText('token ape_live_ABCDEFGHIJKLMNOPQRSTUV and Bearer abcdefghijklmnop'),
      'token [REDACTED:token] and Bearer [REDACTED:token]',
    );
    assert.equal(redactText('postgres://user:pw@db/x'), 'postgres://[REDACTED:credentials]@db/x');
    assert.deepEqual(redactValue({ headers: { cookie: 'a', ok: 'b' } }), {
      headers: { cookie: '[REDACTED:secret]', ok: 'b' },
    });
  });
});
