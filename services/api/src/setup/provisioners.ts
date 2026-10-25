import type { ConnectReaderInput } from '@ape/api-contracts';
import type { FetchFn } from '../tools/readers';

/**
 * "Paste one admin key, we do the rest" (ADR-024). Each provisioner uses the key once to create
 * our alert webhook and a read-only credential in the customer's tool, then forgets the key.
 * Only the read-only credential it returns is stored.
 */
export interface AlertTarget {
  /** Our alert intake URL for this tool's alert source. */
  url: string;
  /** The alert source token. */
  token: string;
}

export interface ProvisionResult {
  /** Read-only connection to store for Way 7, or null if this tool has none to create. */
  reader: ConnectReaderInput | null;
  /** True when the tool now sends alerts to us without any further step. */
  alertsAutomatic: boolean;
  done: string[];
  todo: string[];
}

export class ProvisionError extends Error {}

const TIMEOUT = 15_000;

async function call<T>(
  fetchFn: FetchFn,
  tool: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), redirect: 'error' });
  } catch (err) {
    throw new ProvisionError(`Could not reach ${tool}: ${(err as Error).message}`);
  }
  const text = await res.text();
  if (res.status === 401 || res.status === 403)
    throw new ProvisionError(
      `${tool} rejected the key (HTTP ${res.status}). It needs admin rights for the one-time setup.`,
    );
  if (!res.ok)
    throw new ProvisionError(`${tool} answered HTTP ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const base = (u: string) => u.replace(/\/+$/, '');

// ---------- Grafana: contact point + policy route + Loki read access ----------

interface GrafanaRoute {
  receiver?: string;
  routes?: GrafanaRoute[];
  continue?: boolean;
  object_matchers?: unknown[];
  [k: string]: unknown;
}

export async function provisionGrafana(
  input: { url: string; token: string; serviceLabel?: string },
  alerts: AlertTarget,
  fetchFn: FetchFn,
): Promise<ProvisionResult> {
  const g = base(input.url);
  const auth = { Authorization: `Bearer ${input.token}` };
  const done: string[] = [];
  const todo: string[] = [];
  const name = 'AI Production Engineer';

  // 1. Contact point (webhook with our bearer token). Reuse it if a previous run created it.
  const points = await call<{ uid: string; name: string }[]>(
    fetchFn,
    'Grafana',
    `${g}/api/v1/provisioning/contact-points`,
    { headers: auth },
  );
  const settings = {
    url: alerts.url,
    httpMethod: 'POST',
    authorization_scheme: 'Bearer',
    authorization_credentials: alerts.token,
  };
  const existing = points.find((p) => p.name === name);
  if (existing) {
    await call(fetchFn, 'Grafana', `${g}/api/v1/provisioning/contact-points/${existing.uid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Disable-Provenance': 'true', ...auth },
      body: JSON.stringify({ name, type: 'webhook', settings }),
    });
    done.push('Updated the "AI Production Engineer" contact point.');
  } else {
    await call(
      fetchFn,
      'Grafana',
      `${g}/api/v1/provisioning/contact-points`,
      json({ name, type: 'webhook', settings }, { 'X-Disable-Provenance': 'true', ...auth }),
    );
    done.push('Created the "AI Production Engineer" webhook contact point.');
  }

  // 2. Route every alert to it as well, first and with continue: existing routing is unchanged.
  const tree = await call<GrafanaRoute>(fetchFn, 'Grafana', `${g}/api/v1/provisioning/policies`, {
    headers: auth,
  });
  const routes = tree.routes ?? [];
  if (!routes.some((r) => r.receiver === name)) {
    tree.routes = [{ receiver: name, continue: true, object_matchers: [] }, ...routes];
    await call(fetchFn, 'Grafana', `${g}/api/v1/provisioning/policies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Disable-Provenance': 'true', ...auth },
      body: JSON.stringify(tree),
    });
    done.push(
      'Added a notification policy that also sends every alert to us (your other routes still apply).',
    );
  }

  // 3. Loki through the Grafana data source proxy, with the same token.
  const sources = await call<{ uid: string; name: string; type: string }[]>(
    fetchFn,
    'Grafana',
    `${g}/api/datasources`,
    { headers: auth },
  );
  const loki = sources.find((s) => s.type === 'loki');
  let reader: ConnectReaderInput | null = null;
  if (loki) {
    reader = {
      tool: 'grafana',
      url: `${g}/api/datasources/proxy/uid/${loki.uid}`,
      auth: 'bearer',
      token: input.token,
      serviceLabel: input.serviceLabel ?? 'service_name',
    };
    done.push(`The AI reads logs from the "${loki.name}" Loki data source.`);
    todo.push(
      'Optional: replace the stored token with a Viewer-role service account token (it only needs to read).',
    );
  } else {
    todo.push('No Loki data source was found, so the AI cannot read Grafana logs yet.');
  }
  return { reader, alertsAutomatic: true, done, todo };
}

// ---------- Datadog: webhook integration + log read ----------

export const DATADOG_PAYLOAD = JSON.stringify({
  id: '$ID',
  title: '$EVENT_TITLE',
  body: '$EVENT_MSG',
  alert_transition: '$ALERT_TRANSITION',
  alert_priority: '$ALERT_PRIORITY',
  aggregate: '$AGGREG_KEY',
  tags: '$TAGS',
  link: '$LINK',
  date: '$DATE',
});

export async function provisionDatadog(
  input: { site: string; apiKey: string; appKey: string },
  alerts: AlertTarget,
  fetchFn: FetchFn,
): Promise<ProvisionResult> {
  const api = `https://api.${input.site}`;
  const headers = { 'DD-API-KEY': input.apiKey, 'DD-APPLICATION-KEY': input.appKey };
  const body = {
    name: 'ape',
    url: alerts.url,
    payload: DATADOG_PAYLOAD,
    custom_headers: JSON.stringify({ Authorization: `Bearer ${alerts.token}` }),
    encode_as: 'json',
  };
  // Update when it already exists (a second setup run), otherwise create.
  const path = `${api}/api/v1/integration/webhooks/configuration/webhooks`;
  try {
    await call(fetchFn, 'Datadog', `${path}/ape`, { headers });
    await call(fetchFn, 'Datadog', `${path}/ape`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (!(err instanceof ProvisionError) || !/HTTP 404/.test(err.message)) throw err;
    await call(fetchFn, 'Datadog', path, json(body, headers));
  }
  return {
    reader: {
      tool: 'datadog',
      site: input.site as never,
      apiKey: input.apiKey,
      appKey: input.appKey,
    },
    alertsAutomatic: false,
    done: [
      'Created the "@webhook-ape" webhook in Datadog with our token.',
      'The AI can search Datadog logs (read-only).',
    ],
    todo: [
      'Add `@webhook-ape` to the message of each monitor that should open an incident here.',
      'Optional: scope the application key to logs_read_data only.',
    ],
  };
}

// ---------- Elasticsearch + Kibana: read-only API key and webhook connector ----------

export async function provisionElasticsearch(
  input: {
    url: string;
    kibanaUrl?: string;
    adminApiKey: string;
    index: string;
    serviceField: string;
  },
  alerts: AlertTarget,
  fetchFn: FetchFn,
): Promise<ProvisionResult> {
  const es = base(input.url);
  const auth = { Authorization: `ApiKey ${input.adminApiKey}` };
  const done: string[] = [];
  const todo: string[] = [];

  // A read-only key limited to the log indices; the admin key is not kept.
  const key = await call<{ id: string; api_key: string; encoded?: string }>(
    fetchFn,
    'Elasticsearch',
    `${es}/_security/api_key`,
    json(
      {
        name: 'ai-production-engineer-read',
        role_descriptors: {
          ape_read_logs: {
            indices: [
              {
                names: input.index.split(',').map((i) => i.trim()),
                privileges: ['read', 'view_index_metadata'],
              },
            ],
          },
        },
        metadata: { created_by: 'ai-production-engineer' },
      },
      auth,
    ),
  );
  const encoded = key.encoded ?? Buffer.from(`${key.id}:${key.api_key}`).toString('base64');
  done.push(`Created a read-only API key for \`${input.index}\`.`);

  const alertsAutomatic = false;
  if (input.kibanaUrl) {
    await call(
      fetchFn,
      'Kibana',
      `${base(input.kibanaUrl)}/api/actions/connector`,
      json(
        {
          name: 'AI Production Engineer',
          connector_type_id: '.webhook',
          config: {
            url: alerts.url,
            method: 'post',
            hasAuth: false,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${alerts.token}`,
            },
          },
          secrets: {},
        },
        { ...auth, 'kbn-xsrf': 'true' },
      ),
    );
    done.push('Created the "AI Production Engineer" webhook connector in Kibana.');
    todo.push(
      'In each Kibana rule, add an action with this connector and the body shown on the Tools page (one for Active, one for Recovered).',
    );
  } else {
    todo.push('Add your Kibana URL to create the alert connector automatically.');
  }
  return {
    reader: {
      tool: 'elasticsearch',
      url: es,
      auth: 'apikey',
      token: encoded,
      index: input.index,
      serviceField: input.serviceField,
    },
    alertsAutomatic,
    done,
    todo,
  };
}

// ---------- Better Stack: ClickHouse connection for reading ----------

export async function provisionBetterStack(
  input: { apiToken: string; sourceName?: string },
  _alerts: AlertTarget,
  fetchFn: FetchFn,
): Promise<ProvisionResult> {
  const api = 'https://telemetry.betterstack.com/api/v1';
  const auth = { Authorization: `Bearer ${input.apiToken}` };
  const sources = await call<{ data: { attributes: { name: string; table_name: string } }[] }>(
    fetchFn,
    'Better Stack',
    `${api}/sources`,
    { headers: auth },
  );
  const pick = input.sourceName
    ? sources.data.find((s) => s.attributes.name.toLowerCase() === input.sourceName!.toLowerCase())
    : sources.data[0];
  if (!pick)
    throw new ProvisionError(
      input.sourceName
        ? `No Better Stack source named "${input.sourceName}"`
        : 'Better Stack has no log sources yet',
    );
  const conn = await call<{
    data: { attributes: { host: string; port: number; username: string; password: string } };
  }>(
    fetchFn,
    'Better Stack',
    `${api}/connections`,
    json({ client_type: 'clickhouse', note: 'AI Production Engineer (read-only)' }, auth),
  );
  const a = conn.data.attributes;
  return {
    reader: {
      tool: 'betterstack',
      url: `https://${a.host}${a.port && a.port !== 443 ? `:${a.port}` : ''}`,
      username: a.username,
      password: a.password,
      table: pick.attributes.table_name,
    },
    alertsAutomatic: false,
    done: [
      `The AI reads logs from the "${pick.attributes.name}" source through a new read-only connection.`,
    ],
    todo: [
      'Better Stack only creates outgoing webhooks in its UI: Uptime → Integrations → Webhook, with the URL shown on the Tools page.',
    ],
  };
}

// ---------- Log drains (Way 5) ----------

export async function provisionVercelDrain(
  input: { accessToken: string; teamId?: string | null },
  drain: { logsUrl: string; tracesUrl: string; ingestToken: string },
  fetchFn: FetchFn,
): Promise<{ done: string[] }> {
  const q = input.teamId ? `?teamId=${encodeURIComponent(input.teamId)}` : '';
  const auth = { Authorization: `Bearer ${input.accessToken}` };
  const headers = { Authorization: `Bearer ${drain.ingestToken}` };
  await call(
    fetchFn,
    'Vercel',
    `https://api.vercel.com/v1/drains${q}`,
    json(
      {
        name: 'AI Production Engineer logs',
        projects: 'all',
        schemas: { log: { version: 'v1' } },
        delivery: {
          type: 'http',
          endpoint: drain.logsUrl,
          encoding: 'json',
          compression: 'gzip',
          headers,
        },
      },
      auth,
    ),
  );
  const done = ['Created a Vercel log drain for all projects.'];
  try {
    await call(
      fetchFn,
      'Vercel',
      `https://api.vercel.com/v1/drains${q}`,
      json(
        {
          name: 'AI Production Engineer traces',
          projects: 'all',
          schemas: { trace: { version: 'v1' } },
          delivery: { type: 'otlphttp', endpoint: drain.tracesUrl, encoding: 'proto', headers },
        },
        auth,
      ),
    );
    done.push('Created a Vercel trace drain for all projects.');
  } catch {
    // Trace drains need tracing enabled on the Vercel plan; logs alone are still useful.
  }
  return { done };
}

const HEROKU = 'https://api.heroku.com';
const herokuHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.heroku+json; version=3',
});

export async function listHerokuApps(token: string, fetchFn: FetchFn): Promise<string[]> {
  const apps = await call<{ name: string }[]>(fetchFn, 'Heroku', `${HEROKU}/apps`, {
    headers: herokuHeaders(token),
  });
  return apps.map((a) => a.name).sort();
}

/** Adds one drain per app; the URL names the app because Heroku does not send it. */
export async function provisionHerokuDrains(
  token: string,
  apps: string[],
  drainUrlFor: (app: string) => string,
  fetchFn: FetchFn,
): Promise<{ done: string[]; failed: string[] }> {
  const done: string[] = [];
  const failed: string[] = [];
  for (const app of apps) {
    try {
      await call(fetchFn, 'Heroku', `${HEROKU}/apps/${encodeURIComponent(app)}/log-drains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...herokuHeaders(token) },
        body: JSON.stringify({ url: drainUrlFor(app) }),
      });
      done.push(`Added a log drain to ${app}.`);
    } catch (err) {
      // 422 "already exists" is fine on a second run.
      if (/HTTP 422/.test((err as Error).message) && /already/i.test((err as Error).message))
        done.push(`${app} already drains to us.`);
      else failed.push(`${app}: ${(err as Error).message}`);
    }
  }
  return { done, failed };
}

export async function provisionRenderStream(
  input: { apiKey: string },
  stream: { endpoint: string; token: string },
  fetchFn: FetchFn,
): Promise<{ done: string[] }> {
  const auth = { Authorization: `Bearer ${input.apiKey}`, Accept: 'application/json' };
  const owners = await call<{ owner: { id: string; name: string } }[]>(
    fetchFn,
    'Render',
    'https://api.render.com/v1/owners?limit=20',
    { headers: auth },
  );
  if (!owners.length) throw new ProvisionError('This Render API key has no workspaces');
  const done: string[] = [];
  for (const { owner } of owners) {
    await call(
      fetchFn,
      'Render',
      `https://api.render.com/v1/logs/streams/owner/${encodeURIComponent(owner.id)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ endpoint: stream.endpoint, token: stream.token, preview: 'send' }),
      },
    );
    done.push(`Render workspace "${owner.name}" streams its logs to us.`);
  }
  return { done };
}
