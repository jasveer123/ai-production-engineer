import { execFileSync } from 'node:child_process';
import { createHmac, generateKeyPairSync, createSign, type JsonWebKey } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installScript, kubernetesManifest, vectorConfig } from './agent-install';
import { cloudFormationCommand, cloudFormationTemplate } from './aws';
import { GITHUB_OIDC_ISSUER, verifyGitHubOidc } from './github-oidc';
import { verifySentrySignature } from './oauth';
import {
  provisionBetterStack,
  provisionDatadog,
  provisionElasticsearch,
  provisionGrafana,
  provisionHerokuDrains,
  provisionRenderStream,
  provisionVercelDrain,
} from './provisioners';

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
/** A fake fetch answering by "METHOD path" prefix. */
function fake(routes: Record<string, unknown>, status: Record<string, number> = {}) {
  const calls: Call[] = [];
  const fn = ((url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const raw = typeof init.body === 'string' ? init.body : '';
    let body: unknown = raw;
    try {
      body = JSON.parse(raw);
    } catch {
      /* form or empty */
    }
    const c: Call = { url, method, headers: (init.headers ?? {}) as Record<string, string>, body };
    calls.push(c);
    const key = Object.keys(routes).find((k) => `${method} ${url}`.startsWith(k));
    const r = key ? routes[key] : {};
    const out = typeof r === 'function' ? (r as (c: Call) => unknown)(c) : r;
    return Promise.resolve(
      new Response(JSON.stringify(out ?? {}), { status: key && status[key] ? status[key] : 200 }),
    );
  }) as typeof fetch;
  return { fn, calls };
}
const alerts = { url: 'https://api.example.com/ingest/alerts/src-1', token: 'ape_alert_tok' };

describe('tool provisioners', () => {
  it('Grafana: contact point, routing policy that continues, Loki through the proxy', async () => {
    const { fn, calls } = fake({
      'GET https://g.example.com/api/v1/provisioning/contact-points': [],
      'POST https://g.example.com/api/v1/provisioning/contact-points': { uid: 'cp1' },
      'GET https://g.example.com/api/v1/provisioning/policies': {
        receiver: 'default',
        routes: [{ receiver: 'team' }],
      },
      'PUT https://g.example.com/api/v1/provisioning/policies': {},
      'GET https://g.example.com/api/datasources': [{ uid: 'lk', name: 'Loki', type: 'loki' }],
    });
    const r = await provisionGrafana(
      { url: 'https://g.example.com/', token: 'glsa_x' },
      alerts,
      fn,
    );
    const cp = calls.find((c) => c.method === 'POST')!.body as { settings: Record<string, string> };
    expect(cp.settings).toMatchObject({
      url: alerts.url,
      authorization_scheme: 'Bearer',
      authorization_credentials: 'ape_alert_tok',
    });
    const tree = calls.find((c) => c.method === 'PUT')!.body as {
      routes: { receiver: string; continue?: boolean }[];
    };
    expect(tree.routes[0]).toEqual({
      receiver: 'AI Production Engineer',
      continue: true,
      object_matchers: [],
    });
    expect(tree.routes[1]).toEqual({ receiver: 'team' });
    expect(r.reader).toMatchObject({
      tool: 'grafana',
      url: 'https://g.example.com/api/datasources/proxy/uid/lk',
      token: 'glsa_x',
    });
    expect(r.alertsAutomatic).toBe(true);
  });

  it('Datadog: creates the webhook when missing', async () => {
    const { fn, calls } = fake(
      {
        'GET https://api.datadoghq.eu/api/v1/integration/webhooks/configuration/webhooks/ape': {},
        'POST https://api.datadoghq.eu': {},
      },
      {
        'GET https://api.datadoghq.eu/api/v1/integration/webhooks/configuration/webhooks/ape': 404,
      },
    );
    const r = await provisionDatadog(
      { site: 'datadoghq.eu', apiKey: 'a', appKey: 'b' },
      alerts,
      fn,
    );
    const created = calls.find((c) => c.method === 'POST')!;
    expect(created.headers['DD-API-KEY']).toBe('a');
    expect(JSON.parse((created.body as { custom_headers: string }).custom_headers)).toEqual({
      Authorization: 'Bearer ape_alert_tok',
    });
    expect(r.todo[0]).toMatch(/@webhook-ape/);
  });

  it('Elasticsearch: read-only key on the index, Kibana connector, admin key not returned', async () => {
    const { fn, calls } = fake({
      'POST https://es.example.com/_security/api_key': {
        id: 'k1',
        api_key: 'secret',
        encoded: 'ZW5jb2RlZA==',
      },
      'POST https://kb.example.com/api/actions/connector': { id: 'c1' },
    });
    const r = await provisionElasticsearch(
      {
        url: 'https://es.example.com',
        kibanaUrl: 'https://kb.example.com',
        adminApiKey: 'ADMIN',
        index: 'logs-*',
        serviceField: 'service.name',
      },
      alerts,
      fn,
    );
    const keyReq = calls[0]!.body as {
      role_descriptors: { ape_read_logs: { indices: { names: string[]; privileges: string[] }[] } };
    };
    expect(keyReq.role_descriptors.ape_read_logs.indices[0]).toEqual({
      names: ['logs-*'],
      privileges: ['read', 'view_index_metadata'],
    });
    expect(calls[1]!.headers['kbn-xsrf']).toBe('true');
    expect(r.reader).toMatchObject({ tool: 'elasticsearch', token: 'ZW5jb2RlZA==' });
    expect(JSON.stringify(r.reader)).not.toContain('ADMIN');
  });

  it('Better Stack: picks the source and creates a ClickHouse connection', async () => {
    const { fn } = fake({
      'GET https://telemetry.betterstack.com/api/v1/sources': {
        data: [
          { attributes: { name: 'web', table_name: 't1_web' } },
          { attributes: { name: 'api', table_name: 't1_api' } },
        ],
      },
      'POST https://telemetry.betterstack.com/api/v1/connections': {
        data: {
          attributes: { host: 'eu.connect.example', port: 443, username: 'u', password: 'p' },
        },
      },
    });
    const r = await provisionBetterStack({ apiToken: 't', sourceName: 'API' }, alerts, fn);
    expect(r.reader).toEqual({
      tool: 'betterstack',
      url: 'https://eu.connect.example',
      username: 'u',
      password: 'p',
      table: 't1_api',
    });
  });

  it('Vercel: log drain for all projects with our token header', async () => {
    const { fn, calls } = fake({ 'POST https://api.vercel.com/v1/drains': { id: 'd1' } });
    const r = await provisionVercelDrain(
      { accessToken: 'vt', teamId: 'team_1' },
      {
        logsUrl: 'https://i/v1/drain',
        tracesUrl: 'https://i/v1/traces',
        ingestToken: 'ape_live_x',
      },
      fn,
    );
    expect(calls[0]!.url).toBe('https://api.vercel.com/v1/drains?teamId=team_1');
    expect(calls[0]!.body).toMatchObject({
      projects: 'all',
      schemas: { log: { version: 'v1' } },
      delivery: { endpoint: 'https://i/v1/drain', headers: { Authorization: 'Bearer ape_live_x' } },
    });
    expect(r.done).toHaveLength(2);
  });

  it('Heroku and Render', async () => {
    const h = fake({ 'POST https://api.heroku.com/apps/shop/log-drains': {} });
    const hr = await provisionHerokuDrains(
      'tok',
      ['shop'],
      (a) => `https://ape:x@i/v1/drain?service=${a}`,
      h.fn,
    );
    expect(h.calls[0]!.body).toEqual({ url: 'https://ape:x@i/v1/drain?service=shop' });
    expect(hr.done).toEqual(['Added a log drain to shop.']);
    const r = fake({
      'GET https://api.render.com/v1/owners': [{ owner: { id: 'tea-1', name: 'Shop' } }],
      'PUT https://api.render.com': {},
    });
    await provisionRenderStream(
      { apiKey: 'rk' },
      { endpoint: 'logs.example.com:6514', token: 'ape_live_y' },
      r.fn,
    );
    expect(r.calls[1]!.url).toBe('https://api.render.com/v1/logs/streams/owner/tea-1');
    expect(r.calls[1]!.body).toEqual({
      endpoint: 'logs.example.com:6514',
      token: 'ape_live_y',
      preview: 'send',
    });
  });

  it('explains rejected admin keys', async () => {
    const { fn } = fake({ 'GET https://g.example.com': {} }, { 'GET https://g.example.com': 403 });
    await expect(
      provisionGrafana({ url: 'https://g.example.com', token: 'x' }, alerts, fn),
    ).rejects.toThrow(/admin rights/);
  });
});

describe('GitHub OIDC', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
  const sign = (claims: object, kid = 'k1') => {
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid })).toString('base64url');
    const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const s = createSign('RSA-SHA256').update(`${h}.${p}`).sign(privateKey).toString('base64url');
    return `${h}.${p}.${s}`;
  };
  const now = 1_800_000_000;
  const good = {
    iss: GITHUB_OIDC_ISSUER,
    aud: 'ape',
    exp: now + 300,
    sub: 'repo:o/r:ref:refs/heads/main',
    repository: 'o/r',
    run_id: '9',
  };
  const jwks = () => Promise.resolve([jwk]);

  it('accepts a valid token and returns the repository', async () => {
    await expect(verifyGitHubOidc(sign(good), 'ape', jwks, now)).resolves.toMatchObject({
      repository: 'o/r',
    });
  });
  it('rejects wrong audience, issuer, expiry, key and tampering', async () => {
    await expect(
      verifyGitHubOidc(sign({ ...good, aud: 'other' }), 'ape', jwks, now),
    ).rejects.toThrow(/audience/);
    await expect(
      verifyGitHubOidc(sign({ ...good, iss: 'https://evil' }), 'ape', jwks, now),
    ).rejects.toThrow(/issuer/);
    await expect(
      verifyGitHubOidc(sign({ ...good, exp: now - 3600 }), 'ape', jwks, now),
    ).rejects.toThrow(/expired/);
    await expect(verifyGitHubOidc(sign(good, 'nope'), 'ape', jwks, now)).rejects.toThrow(
      /Unknown signing key/,
    );
    const [h, , s] = sign(good).split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify({ ...good, repository: 'evil/r' })).toString('base64url')}.${s}`;
    await expect(verifyGitHubOidc(forged, 'ape', jwks, now)).rejects.toThrow(/signature/);
  });
});

describe('Sentry webhook signature', () => {
  it('is an HMAC of the raw body', () => {
    const body = Buffer.from('{"action":"created"}');
    const sig = createHmac('sha256', 'secret').update(body).digest('hex');
    expect(verifySentrySignature('secret', body, sig)).toBe(true);
    expect(verifySentrySignature('secret', body, 'bad')).toBe(false);
    expect(verifySentrySignature('secret', body, undefined)).toBe(false);
  });
});

describe('agent installer and AWS template', () => {
  it('the install script is valid POSIX sh and keeps the token out of URLs', () => {
    const script = installScript('https://ingest.example.com');
    const dir = mkdtempSync(join(tmpdir(), 'ape-'));
    writeFileSync(join(dir, 'agent.sh'), script);
    expect(() => execFileSync('sh', ['-n', join(dir, 'agent.sh')])).not.toThrow();
    expect(script).toContain('${APE_TOKEN}');
    expect(script).not.toMatch(/token=\$APE_TOKEN/);
  });
  it('the Kubernetes manifest takes the token from a secret', () => {
    const m = kubernetesManifest('https://i.example.com', 'shop');
    expect(m).toContain('secretRef: { name: ape-agent }');
    expect(m).toContain('type: kubernetes_logs');
    expect(
      vectorConfig({
        endpoint: 'https://i',
        service: 'a b',
        logPaths: ['/var/log/x.log'],
        journald: true,
        docker: false,
      }),
    ).toContain('service=a%20b');
  });
  it('CloudFormation creates read-only access and calls back once', () => {
    const t = cloudFormationTemplate();
    expect(t).toContain("Action: ['logs:FilterLogEvents', 'logs:DescribeLogGroups']");
    expect(t).toContain('Protocol: https');
    expect(t).toContain("if event['RequestType'] != 'Create'");
    const cmd = cloudFormationCommand({
      templateUrl: 'https://a/t.yaml',
      callbackUrl: "https://a/cb/x'y",
      alertUrl: 'https://a/al?token=z',
    });
    expect(cmd).toContain("CallbackUrl='https://a/cb/x'\"'\"'y'");
    expect(cmd).toContain('--capabilities CAPABILITY_IAM');
  });
});
