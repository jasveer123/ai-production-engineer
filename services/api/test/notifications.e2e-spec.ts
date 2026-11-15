import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type {
  Incident,
  NotificationChannel,
  NotificationChannelWithSecret,
  DeliveryAttemptView,
} from '@ape/api-contracts';
import { and, eq, sql } from 'drizzle-orm';
import type { App } from 'supertest/types';
import { createDatabase } from '../src/core/db/client';
import { deliveryAttempts, outbox, secrets } from '../src/core/db/schema';
import { DeliveryLedger } from '../src/modules/notifications/application/delivery-ledger.service';
import { verifySignature } from '../src/ingest/ingestion/domain/webhook-signature';
import { OutboxPublisher } from '../src/core/temporal/outbox-publisher.service';
import { TemporalService } from '../src/core/temporal/temporal.service';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

interface Received {
  path: string;
  headers: IncomingHttpHeaders;
  raw: Buffer;
  body: { type: string; incident: { id: string; status: string; severity: string } };
}

describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let receiver: Server;
  let base: string;
  let publisher: OutboxPublisher;
  const received: Received[] = [];

  const respond = new Map<string, number>();
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);

  beforeAll(async () => {
    app = await createTestApp();
    publisher = app.get(OutboxPublisher);
    jest.spyOn(app.get(TemporalService), 'startIncidentWorkflow').mockResolvedValue('started');
    receiver = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks);
        received.push({
          path: req.url ?? '',
          headers: req.headers,
          raw,
          body: JSON.parse(raw.toString()) as Received['body'],
        });
        res.writeHead(respond.get(req.url ?? '') ?? 200).end('ok');
      });
    });
    await new Promise<void>((r) => receiver.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    await resetDatabase();
    received.length = 0;
    respond.clear();
  });
  afterAll(async () => {
    receiver.close();
    await pool.end();
    await app.close();
  });

  async function setup() {
    const owner = await loginAs(app, 'owner@notify.test');
    const ws = (await createWorkspace(owner, 'Notify')).id;
    return { owner, ws };
  }

  async function addWebhook(
    agent: Awaited<ReturnType<typeof loginAs>>,
    ws: string,
    path: string,
    extra: Record<string, unknown> = {},
  ) {
    return (
      await agent
        .post(`/workspaces/${ws}/notifications/channels`)
        .send({
          kind: 'webhook',
          name: `hook ${path}`,
          url: `${base}${path}`,
          events: ['incident.detected', 'review.requested', 'incident.resolved'],
          ...extra,
        })
        .expect(201)
    ).body as NotificationChannelWithSecret;
  }

  const incident = async (
    agent: Awaited<ReturnType<typeof loginAs>>,
    ws: string,
    severity = 'high',
  ) =>
    (
      await agent
        .post(`/workspaces/${ws}/incidents`)
        .send({ title: 'Checkout returns 500', severity })
        .expect(201)
    ).body as Incident;

  const notifyRows = (ws: string) =>
    db
      .select()
      .from(outbox)
      .where(and(eq(outbox.workspaceId, ws), eq(outbox.topic, 'notify')));

  it('lets admins manage channels, shows the signing secret once and masks targets', async () => {
    const { owner, ws } = await setup();
    await owner
      .post(`/workspaces/${ws}/invitations`)
      .send({ email: 'viewer@notify.test', role: 'viewer' })
      .expect(201);
    const viewer = await loginAs(app, 'viewer@notify.test');
    await viewer
      .post(`/workspaces/${ws}/notifications/channels`)
      .send({ kind: 'webhook', name: 'x', url: `${base}/x`, events: ['incident.detected'] })
      .expect(403);

    const created = await addWebhook(owner, ws, '/a?token=abc');
    expect(created.signingSecret).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(created.target).toBe(`${base}/a`);

    await owner
      .post(`/workspaces/${ws}/notifications/channels`)
      .send({
        kind: 'slack',
        name: 'Slack',
        webhookUrl: 'https://hooks.slack.com/services/T01/B02/secretXYZ',
        events: ['incident.detected'],
      })
      .expect(201);
    await owner
      .post(`/workspaces/${ws}/notifications/channels`)
      .send({
        kind: 'slack',
        name: 'Not slack',
        webhookUrl: 'https://evil.example.com/services/x',
        events: ['incident.detected'],
      })
      .expect(400);

    const list = (await viewer.get(`/workspaces/${ws}/notifications/channels`).expect(200))
      .body as NotificationChannel[];
    expect(list).toHaveLength(2);
    expect(JSON.stringify(list)).not.toContain('secretXYZ');
    expect(JSON.stringify(list)).not.toContain('whsec_');
    expect(list.find((c) => c.kind === 'slack')!.target).toBe('hooks.slack.com/services/T01/…');

    const before = (await db.select().from(secrets).where(eq(secrets.workspaceId, ws))).length;
    await owner.delete(`/workspaces/${ws}/notifications/channels/${created.id}`).expect(204);
    expect((await db.select().from(secrets).where(eq(secrets.workspaceId, ws))).length).toBe(
      before - 1,
    );
  });

  it('enqueues nothing for workspaces without channels', async () => {
    const { owner, ws } = await setup();
    await incident(owner, ws);
    expect(await notifyRows(ws)).toHaveLength(0);
  });

  it('delivers a signed webhook for a new incident from the outbox', async () => {
    const { owner, ws } = await setup();
    const ch = await addWebhook(owner, ws, '/hook');
    const inc = await incident(owner, ws);
    expect(await notifyRows(ws)).toHaveLength(1);

    await publisher.publishBatch();
    expect(received).toHaveLength(1);
    const r = received[0]!;
    expect(r.body).toMatchObject({
      type: 'incident.detected',
      incident: { id: inc.id, severity: 'high' },
    });
    expect(r.headers['x-ape-event']).toBe('incident.detected');
    const check = verifySignature(
      ch.signingSecret!,
      r.headers['x-ape-timestamp'] as string,
      r.headers['x-ape-signature'] as string,
      r.raw,
    );
    expect(check).toEqual({ ok: true });

    const deliveries = (await owner.get(`/workspaces/${ws}/notifications/deliveries`).expect(200))
      .body as DeliveryAttemptView[];
    expect(deliveries).toMatchObject([
      { state: 'delivered', eventType: 'incident.detected', attempts: 1, channel: 'webhook' },
    ]);
  });

  it('filters by severity and event type', async () => {
    const { owner, ws } = await setup();
    await addWebhook(owner, ws, '/high-only', { minSeverity: 'high' });
    await addWebhook(owner, ws, '/resolved-only', { events: ['incident.resolved'] });
    await incident(owner, ws, 'medium');
    await incident(owner, ws, 'critical');
    await publisher.publishBatch();
    expect(received.map((r) => [r.path, r.body.incident.severity])).toEqual([
      ['/high-only', 'critical'],
    ]);
  });

  it('notifies when a fix awaits review, not for every intermediate status', async () => {
    const { owner, ws } = await setup();
    await addWebhook(owner, ws, '/review', { events: ['review.requested'] });
    const inc = await incident(owner, ws);
    let version = inc.version;
    for (const to of ['investigating', 'fix_proposed', 'validation', 'awaiting_review']) {
      version = (
        (
          await owner
            .post(`/workspaces/${ws}/incidents/${inc.id}/transitions`)
            .send({ to, expectedVersion: version })
            .expect(200)
        ).body as Incident
      ).version;
    }
    await publisher.publishBatch();
    expect(received).toHaveLength(1);
    expect(received[0]!.body).toMatchObject({
      type: 'review.requested',
      incident: { status: 'awaiting_review' },
    });
  });

  it('retries a failed channel with backoff and never re-sends to one that succeeded', async () => {
    const { owner, ws } = await setup();
    await addWebhook(owner, ws, '/ok');
    await addWebhook(owner, ws, '/flaky');
    respond.set('/flaky', 503);
    await incident(owner, ws);

    await publisher.publishBatch();
    expect(received.map((r) => r.path).sort()).toEqual(['/flaky', '/ok']);
    expect((await notifyRows(ws))[0]!.publishedAt).not.toBeNull();
    const rows = () =>
      db.select().from(deliveryAttempts).where(eq(deliveryAttempts.workspaceId, ws));
    const flaky = (await rows()).find((d) => d.state === 'retry_wait')!;
    expect(flaky).toMatchObject({ attempts: 1, error: 'Receiver responded 503' });
    expect(flaky.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());

    const ledger = app.get(DeliveryLedger);
    await ledger.processDue();
    expect(received).toHaveLength(2);

    respond.delete('/flaky');
    await db
      .update(deliveryAttempts)
      .set({ nextAttemptAt: sql`now()` })
      .where(eq(deliveryAttempts.id, flaky.id));
    await ledger.processDue(new Date(Date.now() + 1000));
    expect(received.map((r) => r.path).sort()).toEqual(['/flaky', '/flaky', '/ok']);
    expect((await rows()).map((d) => [d.state, d.attempts]).sort()).toEqual([
      ['delivered', 1],
      ['delivered', 2],
    ]);
  });

  it('does not retry a permanent failure (4xx) and shows it on the channel', async () => {
    const { owner, ws } = await setup();
    await addWebhook(owner, ws, '/gone');
    respond.set('/gone', 410);
    await incident(owner, ws);
    await publisher.publishBatch();
    expect((await notifyRows(ws))[0]!.publishedAt).not.toBeNull();
    const [ch] = (await owner.get(`/workspaces/${ws}/notifications/channels`).expect(200))
      .body as NotificationChannel[];
    expect(ch!.lastError).toBe('Receiver responded 410');
  });

  it('sends a test message on demand', async () => {
    const { owner, ws } = await setup();
    const ch = await addWebhook(owner, ws, '/test');
    const res = await owner
      .post(`/workspaces/${ws}/notifications/channels/${ch.id}/test`)
      .expect(200);
    expect(res.body).toEqual({
      ok: true,
      state: 'delivered',
      status: 200,
      error: null,
      providerMessageId: null,
    });
    expect(received[0]!.body.incident).toMatchObject({ status: 'detected', severity: 'low' });
  });

  it('lets only owners change the approval policy', async () => {
    const { owner, ws } = await setup();
    await owner
      .post(`/workspaces/${ws}/invitations`)
      .send({ email: 'admin@notify.test', role: 'admin' })
      .expect(201);
    const admin = await loginAs(app, 'admin@notify.test');
    expect(
      (await admin.get(`/workspaces/${ws}/settings/approval-policy`).expect(200)).body,
    ).toEqual({ prMinRole: 'engineer' });
    await admin
      .put(`/workspaces/${ws}/settings/approval-policy`)
      .send({ prMinRole: 'admin' })
      .expect(403);
    await owner
      .put(`/workspaces/${ws}/settings/approval-policy`)
      .send({ prMinRole: 'viewer' })
      .expect(400);
    await owner
      .put(`/workspaces/${ws}/settings/approval-policy`)
      .send({ prMinRole: 'admin' })
      .expect(200);
    expect(
      (await owner.get(`/workspaces/${ws}/settings/approval-policy`).expect(200)).body,
    ).toEqual({ prMinRole: 'admin' });
  });
});
