import type { FetchFn } from '../tools/readers';
import { call, json, ProvisionError } from './provisioner-http';

/** Log drains (Way 5): Vercel, Heroku and Render send their logs to our ingest. */

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
