import { createHash, createHmac } from 'node:crypto';
import { connectReaderSchema } from '@ape/api-contracts';
import { readLogs, ReaderError, signAwsRequest, splitReaderInput, type FetchFn } from './readers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SignatureV4 } = require(
  require.resolve('@smithy/signature-v4', {
    paths: [
      `${__dirname}/../../../../../../node_modules/.pnpm/@smithy+signature-v4@5.7.4/node_modules`,
    ],
  }),
) as {
  SignatureV4: new (o: unknown) => {
    sign: (r: unknown, o: unknown) => Promise<{ headers: Record<string, string> }>;
  };
};

class Sha256 {
  private readonly h;
  constructor(secret?: Uint8Array | string) {
    this.h = secret ? createHmac('sha256', secret) : createHash('sha256');
  }
  update(d: Uint8Array | string) {
    this.h.update(d);
  }
  digest() {
    return Promise.resolve(new Uint8Array(this.h.digest()));
  }
}

type Call = { url: string; init: RequestInit };
function fakeFetch(body: unknown, status = 200): { fn: FetchFn; calls: Call[] } {
  const calls: Call[] = [];
  const fn = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
    );
  }) as unknown as FetchFn;
  return { fn, calls };
}

const q = {
  service: 'checkout-api',
  environment: 'production',
  from: new Date('2026-10-20T10:00:00Z'),
  to: new Date('2026-10-20T10:15:00Z'),
  limit: 20,
};

describe('log readers', () => {
  it('Loki: builds a LogQL selector and reads streams', async () => {
    const { fn, calls } = fakeFetch({
      data: {
        result: [
          {
            stream: { service_name: 'checkout-api', level: 'error' },
            values: [['1792490400000000000', 'TypeError: boom']],
          },
        ],
      },
    });
    const lines = await readLogs(
      'grafana',
      {
        settings: {
          url: 'https://logs.example.com/',
          auth: 'bearer',
          serviceLabel: 'service_name',
        },
        secrets: { token: 't' },
      },
      { ...q, errorsOnly: true },
      fn,
    );
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/loki/api/v1/query_range');
    expect(url.searchParams.get('query')).toBe(
      '{service_name="checkout-api"} |~ "(?i)(error|exception|fatal|panic)"',
    );
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer t');
    expect(lines).toEqual([
      {
        ts: '2026-10-20T10:00:00.000Z',
        level: 'error',
        message: 'TypeError: boom',
        service: 'checkout-api',
        url: null,
      },
    ]);
  });

  it('Datadog: posts a search with both keys', async () => {
    const { fn, calls } = fakeFetch({
      data: [
        {
          id: 'x',
          attributes: {
            timestamp: '2026-10-20T10:01:00Z',
            status: 'error',
            message: 'db down',
            service: 'checkout-api',
          },
        },
      ],
    });
    const lines = await readLogs(
      'datadog',
      { settings: { site: 'datadoghq.eu' }, secrets: { apiKey: 'a', appKey: 'b' } },
      q,
      fn,
    );
    expect(calls[0]!.url).toBe('https://api.datadoghq.eu/api/v2/logs/events/search');
    expect(
      (JSON.parse(calls[0]!.init.body as string) as { filter: { query: string } }).filter.query,
    ).toBe('service:"checkout-api" env:"production"');
    expect(lines[0]).toMatchObject({ level: 'error', message: 'db down' });
  });

  it('Sentry: lists unresolved issues for the window', async () => {
    const { fn, calls } = fakeFetch([
      {
        title: 'TypeError: x',
        culprit: 'pricing.ts',
        lastSeen: '2026-10-20T10:02:00Z',
        level: 'error',
        permalink: 'https://sentry.io/i/1',
        count: '12',
      },
    ]);
    const lines = await readLogs(
      'sentry',
      { settings: { url: 'https://sentry.io', organization: 'shop' }, secrets: { token: 's' } },
      q,
      fn,
    );
    expect(calls[0]!.url).toContain('/api/0/organizations/shop/issues/?query=is%3Aunresolved');
    expect(lines[0]).toMatchObject({
      message: 'TypeError: x in pricing.ts (12 events)',
      url: 'https://sentry.io/i/1',
    });
  });

  it('Better Stack: uses query parameters, never string-built SQL values', async () => {
    const { fn, calls } = fakeFetch(
      '{"dt":"2026-10-20 10:03:00.000","raw":"{\\"message\\":\\"slow\\",\\"level\\":\\"warn\\"}"}\n',
    );
    const lines = await readLogs(
      'betterstack',
      {
        settings: { url: 'https://eu.connect.example', username: 'u', table: 't1_app_logs' },
        secrets: { password: 'p' },
      },
      { ...q, service: "x' OR 1=1 --" },
      fn,
    );
    const sql = calls[0]!.init.body as string;
    expect(sql).toContain('FROM remote(t1_app_logs)');
    expect(sql).not.toContain('OR 1=1');
    expect(new URL(calls[0]!.url).searchParams.get('param_service')).toBe("x' OR 1=1 --");
    expect(lines[0]).toMatchObject({
      ts: '2026-10-20T10:03:00.000Z',
      level: 'warn',
      message: 'slow',
    });
  });

  it('CloudWatch: signs FilterLogEvents per log group', async () => {
    const { fn, calls } = fakeFetch({
      events: [{ timestamp: 1792490400000, message: 'ERROR payment failed\n' }],
    });
    const lines = await readLogs(
      'cloudwatch',
      {
        settings: { region: 'eu-west-1', accessKeyId: 'AKIDEXAMPLE', logGroups: '/ecs/a,/ecs/b' },
        secrets: { secretAccessKey: 'secret' },
      },
      q,
      fn,
    );
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe('https://logs.eu-west-1.amazonaws.com/');
    expect((calls[0]!.init.headers as Record<string, string>)['X-Amz-Target']).toBe(
      'Logs_20140328.FilterLogEvents',
    );
    expect(lines[0]).toMatchObject({ level: 'error', message: 'ERROR payment failed' });
  });

  it('Elasticsearch: filters by time and service field', async () => {
    const { fn, calls } = fakeFetch({
      hits: {
        hits: [
          {
            _source: {
              '@timestamp': '2026-10-20T10:04:00Z',
              message: 'boom',
              log: { level: 'error' },
              service: { name: 'checkout-api' },
            },
          },
        ],
      },
    });
    const lines = await readLogs(
      'elasticsearch',
      {
        settings: {
          url: 'https://es.example',
          auth: 'apikey',
          index: 'logs-*',
          serviceField: 'service.name',
        },
        secrets: { token: 'k' },
      },
      q,
      fn,
    );
    expect(calls[0]!.url).toBe('https://es.example/logs-*/_search');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('ApiKey k');
    expect(lines[0]).toEqual({
      ts: '2026-10-20T10:04:00Z',
      level: 'error',
      message: 'boom',
      service: 'checkout-api',
      url: null,
    });
  });

  it('explains rejected credentials in plain words', async () => {
    const { fn } = fakeFetch({ errors: ['Forbidden'] }, 403);
    await expect(
      readLogs('datadog', { settings: {}, secrets: { apiKey: 'a', appKey: 'b' } }, q, fn),
    ).rejects.toThrow(ReaderError);
    await expect(
      readLogs('datadog', { settings: {}, secrets: { apiKey: 'a', appKey: 'b' } }, q, fn),
    ).rejects.toThrow(/rejected the credentials/);
  });
});

describe('SigV4', () => {
  it('matches the AWS SDK signer', async () => {
    const now = new Date('2026-10-20T10:00:00Z');
    const body = '{"logGroupName":"/ecs/a"}';
    const ours = signAwsRequest({
      region: 'eu-west-1',
      service: 'logs',
      host: 'logs.eu-west-1.amazonaws.com',
      target: 'Logs_20140328.FilterLogEvents',
      body,
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      now,
    });
    const signer = new SignatureV4({
      service: 'logs',
      region: 'eu-west-1',
      credentials: {
        accessKeyId: 'AKIDEXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      },
      sha256: Sha256,
      applyChecksum: false,
    });
    const signed = await signer.sign(
      {
        method: 'POST',
        protocol: 'https:',
        hostname: 'logs.eu-west-1.amazonaws.com',
        path: '/',
        query: {},
        body,
        headers: {
          host: 'logs.eu-west-1.amazonaws.com',
          'content-type': 'application/x-amz-json-1.1',
          'x-amz-target': 'Logs_20140328.FilterLogEvents',
        },
      },
      { signingDate: now },
    );
    expect(ours.Authorization).toBe(signed.headers.authorization);
  });
});

describe('reader input', () => {
  it('keeps secrets out of visible settings', () => {
    const input = connectReaderSchema.parse({
      tool: 'cloudwatch',
      region: 'eu-west-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 's3cr3t',
      logGroups: ['/a', '/b'],
    });
    expect(splitReaderInput(input as never)).toEqual({
      settings: { region: 'eu-west-1', accessKeyId: 'AKIAIOSFODNN7EXAMPLE', logGroups: '/a,/b' },
      secrets: { secretAccessKey: 's3cr3t' },
    });
  });
});
