/**
 * Live updates (Phase 8): Postgres NOTIFY -> RealtimeService -> SSE, scoped to one workspace,
 * carrying ids only, and closed for people who lose access.
 */
import { get, type IncomingMessage } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { Incident, LiveChange } from '@ape/api-contracts';
import { firstValueFrom, filter, take, timeout } from 'rxjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createDatabase } from '../src/db/client';
import { incidents, sessions } from '../src/db/schema';
import { RealtimeService, dedupeChanges, parseChange } from '../src/realtime/realtime.service';
import { TemporalService } from '../src/temporal/temporal.service';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

interface SseEvent {
  event: string;
  data: unknown;
}

/** Minimal SSE client: collects events from a streaming response. */
function openStream(url: string, cookie: string) {
  const events: SseEvent[] = [];
  let res: IncomingMessage | undefined;
  const opened = new Promise<number>((resolve, reject) => {
    const req = get(url, { headers: { cookie, accept: 'text/event-stream' } }, (r) => {
      res = r;
      let buf = '';
      r.setEncoding('utf8');
      r.on('data', (chunk: string) => {
        buf += chunk;
        let i: number;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const ev: SseEvent = { event: 'message', data: null };
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) ev.event = line.slice(7);
            if (line.startsWith('data: ')) ev.data = JSON.parse(line.slice(6));
          }
          events.push(ev);
        }
      });
      resolve(r.statusCode ?? 0);
    });
    req.on('error', reject);
  });
  const waitFor = async (pred: (e: SseEvent) => boolean, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const hit = events.find(pred);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`No matching event; got ${JSON.stringify(events)}`);
  };
  const ended = () =>
    new Promise<void>((resolve) => {
      if (!res || res.readableEnded) return resolve();
      res.on('end', resolve);
      res.on('close', resolve);
    });
  return { events, opened, waitFor, ended, close: () => res?.destroy() };
}

describe('Live updates over SSE (e2e)', () => {
  let app: INestApplication<App>;
  let realtime: RealtimeService;
  let baseUrl: string;
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);

  beforeAll(async () => {
    process.env.REALTIME_RECHECK_MS = '300';
    process.env.REALTIME_BATCH_MS = '100';
    app = await createTestApp();
    jest.spyOn(app.get(TemporalService), 'startIncidentWorkflow').mockResolvedValue('started');
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${((app.getHttpServer() as unknown as Server).address() as AddressInfo).port}`;
    realtime = app.get(RealtimeService);
    await realtime.whenReady();
  });
  beforeEach(() => resetDatabase());
  afterAll(async () => {
    delete process.env.REALTIME_RECHECK_MS;
    delete process.env.REALTIME_BATCH_MS;
    await pool.end();
    await app.close();
  });

  async function cookieFor(email: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ email })
      .expect(204);
    return ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .map((c) => c.split(';')[0])
      .join('; ');
  }

  it('parses and dedupes trigger payloads defensively', () => {
    expect(parseChange('not json')).toBeNull();
    expect(parseChange(JSON.stringify({ w: 'nope', t: 'incidents' }))).toBeNull();
    const w = '00000000-0000-4000-8000-000000000000';
    expect(parseChange(JSON.stringify({ w, t: 'incidents', i: 'x' }))).toEqual({
      w,
      t: 'incidents',
      i: null,
    });
    const c: LiveChange = { table: 'incident_events', incidentId: w };
    expect(dedupeChanges([c, c, { ...c, table: 'incidents' }])).toHaveLength(2);
  });

  it('publishes database changes for one workspace only', async () => {
    const owner = await loginAs(app, 'owner@live.test');
    const ws = (await createWorkspace(owner, 'Live')).id;
    const other = (await createWorkspace(owner, 'Other')).id;
    const mine = firstValueFrom(
      realtime.changes(ws).pipe(
        filter((c) => c.table === 'incidents'),
        take(1),
        timeout(5000),
      ),
    );
    const leaked: LiveChange[] = [];
    const sub = realtime.changes(other).subscribe((c) => leaked.push(c));
    const inc = (
      await owner.post(`/workspaces/${ws}/incidents`).send({ title: 'Live one' }).expect(201)
    ).body as Incident;
    expect(await mine).toEqual({ table: 'incidents', incidentId: inc.id });
    sub.unsubscribe();
    expect(leaked).toHaveLength(0);
  });

  it('streams change events with ids only, and refuses non-members', async () => {
    const owner = await loginAs(app, 'owner@sse.test');
    const ws = (await createWorkspace(owner, 'SSE')).id;
    const stream = openStream(
      `${baseUrl}/workspaces/${ws}/stream`,
      await cookieFor('owner@sse.test'),
    );
    expect(await stream.opened).toBe(200);
    await stream.waitFor((e) => e.event === 'ready');

    const inc = (
      await owner
        .post(`/workspaces/${ws}/incidents`)
        .send({ title: 'Database is on fire' })
        .expect(201)
    ).body as Incident;
    const change = await stream.waitFor((e) => e.event === 'change');
    const data = change.data as LiveChange[];
    expect(data).toEqual(expect.arrayContaining([{ table: 'incidents', incidentId: inc.id }]));
    expect(JSON.stringify(stream.events)).not.toContain('Database is on fire');
    stream.close();

    await loginAs(app, 'stranger@sse.test');
    const outsider = openStream(
      `${baseUrl}/workspaces/${ws}/stream`,
      await cookieFor('stranger@sse.test'),
    );
    expect(await outsider.opened).toBe(404);
    outsider.close();
  });

  it('closes the stream when the session is revoked', async () => {
    const owner = await loginAs(app, 'owner@revoke.test');
    const ws = (await createWorkspace(owner, 'Revoke')).id;
    const stream = openStream(
      `${baseUrl}/workspaces/${ws}/stream`,
      await cookieFor('owner@revoke.test'),
    );
    expect(await stream.opened).toBe(200);
    await stream.waitFor((e) => e.event === 'ready');
    await db.update(sessions).set({ revokedAt: new Date() });
    await stream.ended(); // re-checked every 300 ms in this test
    // Nothing is sent after that, even though changes keep happening.
    const count = stream.events.length;
    await db.update(incidents).set({ title: 'changed' });
    await new Promise((r) => setTimeout(r, 300));
    expect(stream.events.length).toBe(count);
  });
});
