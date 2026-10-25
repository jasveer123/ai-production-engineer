import { jsonLogsToBatch, sdkErrorsToBatch, vercelToBatch } from './formats';
import { maskToken, newIngestToken } from './ingest-tokens.service';
import { streamState } from './ingest.service';
import { parseLogQuery } from './log-query';
import { logsToBatch, metricsToBatch, tracesToBatch } from './otlp';
import { decodeLogs, decodeMetrics, decodeTraces, Writer } from './protobuf';
import {
  logplexToBatch,
  parseOctetFrames,
  parseSyslog,
  syslogToken,
  syslogToLog,
} from './syslog-format';
import { levelFromSeverityNumber, parseDate, toLevel } from './types';

const kv = (key: string, value: string) =>
  new Writer().string(1, key).message(2, new Writer().string(1, value));
const resource = (service: string, env = 'staging') =>
  new Writer()
    .message(1, kv('service.name', service))
    .message(1, kv('deployment.environment.name', env));
const T0 = BigInt(Date.UTC(2026, 9, 20, 10, 0, 0)) * 1_000_000n;
const TRACE = Buffer.from('4bf92f3577b34da6a3ce929d0e0e4736', 'hex');
const SPAN = Buffer.from('00f067aa0ba902b7', 'hex');

describe('OTLP protobuf', () => {
  it('decodes an error span with an exception event into a span and an error', () => {
    const event = new Writer()
      .fixed64(1, T0 + 5_000_000n)
      .string(2, 'exception')
      .message(3, kv('exception.type', 'TypeError'))
      .message(3, kv('exception.message', "Cannot read properties of null (reading 'percentOff')"))
      .message(3, kv('exception.stacktrace', 'TypeError: x\n    at price (src/pricing.ts:81:46)'));
    const span = new Writer()
      .bytes(1, TRACE)
      .bytes(2, SPAN)
      .string(5, 'POST /checkout')
      .uint(6, 2)
      .fixed64(7, T0)
      .fixed64(8, T0 + 12_500_000n)
      .message(9, kv('http.route', '/checkout'))
      .message(11, event)
      .message(15, new Writer().string(2, 'boom').uint(3, 2));
    const req = new Writer().message(
      1,
      new Writer().message(1, resource('checkout-api')).message(2, new Writer().message(2, span)),
    );

    const batch = tracesToBatch(decodeTraces(req.finish()));
    expect(batch.spans).toHaveLength(1);
    expect(batch.spans[0]).toMatchObject({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      service: 'checkout-api',
      environment: 'staging',
      name: 'POST /checkout',
      kind: 2,
      durationMs: 12.5,
      statusCode: 2,
    });
    expect(batch.errors[0]).toMatchObject({
      errorType: 'TypeError',
      route: '/checkout',
      stack: ['at price (src/pricing.ts:81:46)'],
      eventId: 'span:4bf92f3577b34da6a3ce929d0e0e4736:00f067aa0ba902b7',
    });
  });

  it('decodes log records with severity, body and trace context', () => {
    const rec = new Writer()
      .fixed64(1, T0)
      .uint(2, 17)
      .string(3, 'ERROR')
      .message(5, new Writer().string(1, 'payment failed'))
      .bytes(9, TRACE)
      .bytes(10, SPAN);
    const req = new Writer().message(
      1,
      new Writer().message(1, resource('payments')).message(2, new Writer().message(2, rec)),
    );
    const batch = logsToBatch(decodeLogs(req.finish()));
    expect(batch.logs[0]).toMatchObject({
      level: 'error',
      message: 'payment failed',
      service: 'payments',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    });
    expect(batch.errors).toHaveLength(0); // no exception attributes
  });

  it('counts metrics without storing them, and skips unknown fields', () => {
    const metric = new Writer().string(1, 'http.server.duration').string(2, 'desc');
    const req = new Writer()
      .message(
        1,
        new Writer()
          .message(1, resource('api'))
          .message(2, new Writer().message(2, metric).message(2, metric)),
      )
      .uint(99, 7);
    expect(metricsToBatch(decodeMetrics(req.finish()) as never).metrics).toEqual([
      { service: 'api', environment: 'staging', count: 2 },
    ]);
  });

  it('rejects truncated input', () => {
    expect(() => decodeTraces(Uint8Array.from([0x0a, 0x05, 0x01]))).toThrow(/truncated/);
  });
});

describe('OTLP JSON', () => {
  it('reads hex ids, string enums and string nanos', () => {
    const batch = tracesToBatch({
      resourceSpans: [
        {
          resource: { attributes: [{ key: 'service.name', value: { stringValue: 'web' } }] },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
                  spanId: '00f067aa0ba902b7',
                  name: 'GET /',
                  kind: 'SPAN_KIND_SERVER',
                  startTimeUnixNano: String(T0),
                  endTimeUnixNano: String(T0 + 1_000_000n),
                  status: { code: 'STATUS_CODE_OK' },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(batch.spans[0]).toMatchObject({
      kind: 2,
      statusCode: 1,
      environment: 'production',
      durationMs: 1,
    });
  });
});

describe('OTLP errors and HTTP status', () => {
  // An exception on the inner handler span; the status code lives on the server span.
  const trace = (status: number) =>
    tracesToBatch({
      resourceSpans: [
        {
          resource: { attributes: [{ key: 'service.name', value: { stringValue: 'shop' } }] },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
                  spanId: '00f067aa0ba902b7',
                  name: 'POST /checkout',
                  kind: 'SPAN_KIND_SERVER',
                  startTimeUnixNano: String(T0),
                  endTimeUnixNano: String(T0 + 2_000_000n),
                  attributes: [{ key: 'http.response.status_code', value: { intValue: status } }],
                  status: { code: 'STATUS_CODE_ERROR' },
                },
                {
                  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
                  spanId: '00f067aa0ba902b8',
                  parentSpanId: '00f067aa0ba902b7',
                  name: 'request handler - /checkout',
                  kind: 'SPAN_KIND_INTERNAL',
                  startTimeUnixNano: String(T0),
                  endTimeUnixNano: String(T0 + 1_000_000n),
                  status: { code: 'STATUS_CODE_ERROR' },
                  events: [
                    {
                      name: 'exception',
                      timeUnixNano: String(T0),
                      attributes: [
                        { key: 'exception.type', value: { stringValue: 'PaymentDeclined' } },
                        { key: 'exception.message', value: { stringValue: 'Card declined' } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

  it('does not open incidents for exceptions that ended as a 4xx response', () => {
    const batch = trace(402);
    expect(batch.spans).toHaveLength(2);
    expect(batch.errors).toHaveLength(0);
  });

  it('keeps 5xx exceptions and records the status from the server span', () => {
    const batch = trace(500);
    expect(batch.errors).toHaveLength(1);
    expect(batch.errors[0]).toMatchObject({ errorType: 'PaymentDeclined', httpStatus: 500 });
  });
});

describe('plain JSON logs (HTTP API, Vector, Fluent Bit)', () => {
  it('maps common field names and lifts JSON messages', () => {
    const body = [
      JSON.stringify({ message: 'Checkout failed', level: 'error', service: 'checkout-api' }),
      JSON.stringify({
        log: '{"msg":"inner","level":"warn","trace_id":"4bf92f3577b34da6a3ce929d0e0e4736"}',
        kubernetes: { container_name: 'orders' },
        date: 1792490400.5,
      }),
      JSON.stringify({
        msg: 'pino',
        level: 50,
        time: 1792490400123,
        err: { type: 'Error', message: 'db down', stack: 'Error: db down\n    at q (db.js:1:1)' },
      }),
    ].join('\n');
    const batch = jsonLogsToBatch(body, 'http');
    expect(batch.logs.map((l) => [l.service, l.level, l.message])).toEqual([
      ['checkout-api', 'error', 'Checkout failed'],
      ['orders', 'warn', 'inner'],
      ['unknown-service', 'error', 'pino'],
    ]);
    expect(batch.logs[1]!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(batch.errors).toHaveLength(1);
    expect(batch.errors[0]).toMatchObject({
      errorType: 'Error',
      message: 'db down',
      stack: ['at q (db.js:1:1)'],
    });
  });

  it('Vector file records use the service from the URL, not source_type', () => {
    const batch = jsonLogsToBatch(
      JSON.stringify([
        {
          file: '/logs/app.log',
          host: 'web-1',
          message: '{"level":"error","msg":"boom"}',
          source_type: 'file',
          timestamp: '2026-10-20T10:00:00Z',
        },
      ]),
      'agent',
      { service: 'shop' },
    );
    expect(batch.logs[0]).toMatchObject({
      service: 'shop',
      level: 'error',
      message: 'boom',
      host: 'web-1',
    });
  });

  it('accepts a JSON array and uses query defaults', () => {
    const batch = jsonLogsToBatch('[{"message":"a"},{"message":"b"}]', 'agent', {
      service: 'nginx',
      environment: 'prod',
    });
    expect(batch.logs.map((l) => `${l.service}/${l.environment}`)).toEqual([
      'nginx/prod',
      'nginx/prod',
    ]);
  });

  it('rejects garbage', () => {
    expect(() => jsonLogsToBatch('{not json', 'http')).toThrow(/neither JSON nor NDJSON/);
  });
});

describe('SDK errors', () => {
  it('turns an error event into an incident error and a log line', () => {
    const batch = sdkErrorsToBatch(
      JSON.stringify({
        event_id: 'e1',
        type: 'TypeError',
        message: 'x is null',
        stack: 'TypeError: x is null\n    at a (b.js:1:2)',
        service: 'shop',
        route: '/cart',
        method: 'POST',
        status_code: 500,
      }),
    );
    expect(batch.errors[0]).toMatchObject({
      errorType: 'TypeError',
      eventId: 'sdk:e1',
      operation: 'POST /cart',
      httpStatus: 500,
    });
    expect(batch.logs[0]).toMatchObject({ level: 'error', dedupKey: 'sdk:e1' });
  });
  it('requires a type', () => {
    expect(() => sdkErrorsToBatch('{"message":"no type"}')).toThrow();
  });
});

describe('Vercel drains', () => {
  it('maps project, environment and crashed functions, with a dedup key', () => {
    const batch = vercelToBatch(
      JSON.stringify([
        {
          id: 'l1',
          deploymentId: 'dpl',
          source: 'lambda',
          host: 'shop.vercel.app',
          timestamp: 1792490400000,
          projectId: 'p',
          projectName: 'shop',
          level: 'info',
          message: 'ok',
          environment: 'production',
          traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        },
        {
          id: 'l2',
          deploymentId: 'dpl',
          source: 'lambda',
          host: 'shop.vercel.app',
          timestamp: 1792490400000,
          projectId: 'p',
          message: 'Task timed out',
          statusCode: -1,
          type: 'stderr',
          environment: 'preview',
        },
      ]),
    );
    expect(batch.logs.map((l) => [l.service, l.environment, l.level, l.dedupKey])).toEqual([
      ['shop', 'production', 'info', 'vercel:l1'],
      ['p', 'preview', 'fatal', 'vercel:l2'],
    ]);
  });
});

describe('Heroku logplex and syslog', () => {
  const frame = (line: string) => `${Buffer.byteLength(line) + 1} ${line}\n`;
  const body =
    frame('<40>1 2012-11-30T06:45:29+00:00 host app web.3 - State changed from starting to up') +
    frame(
      '<158>1 2026-10-20T10:00:00+00:00 host heroku router - at=error code=H12 desc="Request timeout" method=GET path="/" host=myapp.herokuapp.com status=503',
    );

  it('splits octet-counted frames', () => {
    const frames = parseOctetFrames(body);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toBe(
      '<40>1 2012-11-30T06:45:29+00:00 host app web.3 - State changed from starting to up',
    );
  });

  it('turns router errors into incident errors and dedups by frame', () => {
    const batch = logplexToBatch(body, 'frame-1', { service: 'myapp' });
    expect(batch.logs).toHaveLength(2);
    expect(batch.logs[0]).toMatchObject({
      service: 'myapp',
      message: 'State changed from starting to up',
      dedupKey: 'heroku:frame-1:0',
    });
    expect(batch.errors[0]).toMatchObject({ errorType: 'HerokuH12', message: 'Request timeout' });
  });

  it('parses RFC 5424 structured data and finds the token', () => {
    const m = parseSyslog(
      '<14>1 2026-10-20T10:00:00Z render-host checkout-web 12 - [ape_live_abc@41058 region="oregon"] {"level":"error","msg":"boom"}',
    )!;
    expect(syslogToken(m)).toBe('ape_live_abc');
    const log = syslogToLog(m);
    expect(log).toMatchObject({
      service: 'checkout-web',
      level: 'error',
      message: 'boom',
      host: 'render-host',
    });
    expect(log.attributes['sd.region']).toBe('oregon');
  });

  it('accepts a token prefix and RFC 3164', () => {
    const m = parseSyslog(
      '<11>Oct 20 10:00:00 web1 nginx[42]: token=ape_live_xyz upstream timed out',
    )!;
    expect(syslogToken(m)).toBe('ape_live_xyz');
    expect(syslogToLog(m)).toMatchObject({
      service: 'nginx',
      level: 'error',
      message: 'upstream timed out',
    });
  });
});

describe('helpers', () => {
  it('maps levels and severity numbers', () => {
    expect(toLevel('WARNING')).toBe('warn');
    expect(toLevel(60)).toBe('fatal');
    expect(levelFromSeverityNumber(9)).toBe('info');
    expect(levelFromSeverityNumber(24)).toBe('fatal');
  });
  it('reads seconds, ms and ns timestamps, and rejects nonsense', () => {
    const iso = '2026-10-20T10:00:00.000Z';
    const ms = Date.parse(iso);
    expect(parseDate(ms / 1000).toISOString()).toBe(iso);
    expect(parseDate(ms).toISOString()).toBe(iso);
    expect(parseDate(ms * 1e6).toISOString()).toBe(iso);
    const fallback = new Date(0);
    expect(parseDate('yesterday', fallback)).toBe(fallback);
  });
  it('makes tokens and masks them', () => {
    const t = newIngestToken();
    expect(t).toMatch(/^ape_live_[A-Za-z0-9]{32}$/);
    expect(maskToken(t.slice(-4))).toMatch(/^ape_live_•+\w{4}$/);
  });
  it('computes stream state', () => {
    const now = Date.now();
    expect(streamState(null, now)).toBe('not_set_up');
    expect(streamState(new Date(now - 60_000), now)).toBe('receiving');
    expect(streamState(new Date(now - 20 * 60_000), now)).toBe('silent');
  });
  it('parses the log search syntax', () => {
    expect(
      parseLogQuery(
        'level:error,fatal service:Checkout env:prod trace:4bf9 "exact phrase" word level:nope',
      ),
    ).toEqual({
      levels: ['error', 'fatal'],
      services: ['checkout'],
      environments: ['prod'],
      traceIds: ['4bf9'],
      hosts: [],
      ways: [],
      text: ['exact phrase', 'word', 'level:nope'],
    });
  });
});
