import type { ConnectReaderInput } from '@ape/api-contracts';
import type { FetchFn } from '../../tools/domain/readers';
import { base, call, json, ProvisionError } from './provisioner-http';

export interface AlertTarget {
  url: string;

  token: string;
}

export interface ProvisionResult {
  reader: ConnectReaderInput | null;

  alertsAutomatic: boolean;
  done: string[];
  todo: string[];
}

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

interface ElasticsearchInput {
  url: string;
  kibanaUrl?: string;
  adminApiKey: string;
  index: string;
  serviceField: string;
}

async function createElasticsearchReadKey(
  input: ElasticsearchInput,
  fetchFn: FetchFn,
): Promise<string> {
  const key = await call<{ id: string; api_key: string; encoded?: string }>(
    fetchFn,
    'Elasticsearch',
    `${base(input.url)}/_security/api_key`,
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
      { Authorization: `ApiKey ${input.adminApiKey}` },
    ),
  );
  return key.encoded ?? Buffer.from(`${key.id}:${key.api_key}`).toString('base64');
}

async function createKibanaConnector(
  input: ElasticsearchInput & { kibanaUrl: string },
  alerts: AlertTarget,
  fetchFn: FetchFn,
): Promise<void> {
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
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${alerts.token}` },
        },
        secrets: {},
      },
      { Authorization: `ApiKey ${input.adminApiKey}`, 'kbn-xsrf': 'true' },
    ),
  );
}

export async function provisionElasticsearch(
  input: ElasticsearchInput,
  alerts: AlertTarget,
  fetchFn: FetchFn,
): Promise<ProvisionResult> {
  const encoded = await createElasticsearchReadKey(input, fetchFn);
  const done = [`Created a read-only API key for \`${input.index}\`.`];
  const todo: string[] = [];
  if (input.kibanaUrl) {
    await createKibanaConnector({ ...input, kibanaUrl: input.kibanaUrl }, alerts, fetchFn);
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
      url: base(input.url),
      auth: 'apikey',
      token: encoded,
      index: input.index,
      serviceField: input.serviceField,
    },
    alertsAutomatic: false,
    done,
    todo,
  };
}

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
