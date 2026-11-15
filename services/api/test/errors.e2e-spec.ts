import type { INestApplication } from '@nestjs/common';
import type { ErrorGroupDetail, ErrorGroupView, IngestTokenWithSecret } from '@ape/api-contracts';
import request from 'supertest';
import type { App } from 'supertest/types';
import { IngestionProcessor } from '../src/ingest/ingestion/application/ingestion.processor';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

describe('Error tracking (e2e)', () => {
  let app: INestApplication<App>;
  let owner: ReturnType<typeof request.agent>;
  let ws: string;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase();
    owner = await loginAs(app, 'owner@errors.test');
    ws = (await createWorkspace(owner, 'Errors')).id;
    token = (
      (await owner.post(`/workspaces/${ws}/ingest/tokens`).send({ name: 'Default' }).expect(201))
        .body as IngestTokenWithSecret
    ).token;
  });
  afterAll(() => app.close());

  const report = async (id: string, extra = {}) => {
    await request(app.getHttpServer())
      .post('/v1/errors')
      .set('Authorization', `Bearer ${token}`)
      .set('x-ape-sdk', 'node/0.1.0')
      .send({
        event_id: id,
        type: 'RangeError',
        message: `bad quantity ${id.length}${Math.floor(Math.random() * 90) + 10}`,
        service: 'shop',
        stack: 'RangeError: bad qty\n    at cart (src/cart.js:3:9)',
        ...extra,
      })
      .expect(202);
    await app.get(IngestionProcessor).processBatch();
  };
  const list = async (query = {}) =>
    (await owner.get(`/workspaces/${ws}/errors`).query(query).expect(200)).body as ErrorGroupView[];
  const incidents = async () =>
    (await owner.get(`/workspaces/${ws}/incidents`).expect(200)).body as unknown[];

  it('groups repeats, tracks counts and lets people resolve or ignore', async () => {
    await report('e1');
    await report('e2');
    await report('e3');
    await report('o1', { type: 'TypeError', message: 'x is null' });

    const groups = await list();
    expect(groups).toHaveLength(2);
    const range = groups.find((g) => g.errorType === 'RangeError')!;
    expect(range).toMatchObject({ count: 3, status: 'unresolved', service: 'shop' });
    expect(range.incidentId).toBeTruthy();

    const detail = (await owner.get(`/workspaces/${ws}/errors/${range.id}`).expect(200))
      .body as ErrorGroupDetail;
    expect(detail.stack[0]).toContain('cart');
    expect(detail.occurrences).toHaveLength(3);
    expect(detail.hourly).toHaveLength(24);
    expect(detail.hourly.reduce((n, h) => n + h.count, 0)).toBe(3);

    await owner
      .patch(`/workspaces/${ws}/errors/${range.id}`)
      .send({ status: 'ignored' })
      .expect(200);
    const before = (await incidents()).length;
    await report('e4');
    expect((await list({ status: 'ignored' }))[0]).toMatchObject({ count: 4 });
    expect(await incidents()).toHaveLength(before);

    await owner
      .patch(`/workspaces/${ws}/errors/${range.id}`)
      .send({ status: 'resolved' })
      .expect(200);
    await report('e5');
    expect((await list({ status: 'unresolved' })).find((g) => g.id === range.id)).toMatchObject({
      count: 5,
      status: 'unresolved',
    });
    expect(
      (await list({ status: 'unresolved' })).find((g) => g.id === range.id)!.reopenedAt,
    ).toBeTruthy();
    expect(await list({ q: 'null' })).toHaveLength(1);
  });

  it('keeps errors per workspace and requires engineers to change status', async () => {
    await report('x1');
    const [group] = await list();
    const other = await loginAs(app, 'other@errors.test');
    const otherWs = (await createWorkspace(other, 'Other')).id;
    await other.get(`/workspaces/${otherWs}/errors/${group!.id}`).expect(404);
    await owner
      .post(`/workspaces/${ws}/invitations`)
      .send({ email: 'viewer@errors.test', role: 'viewer' })
      .expect(201);
    const viewer = await loginAs(app, 'viewer@errors.test');
    await viewer
      .patch(`/workspaces/${ws}/errors/${group!.id}`)
      .send({ status: 'resolved' })
      .expect(403);
  });

  it('assigns an error, lists releases and symbolicates stacks with source maps', async () => {
    await report('r1', {
      release: '2.0.0',
      type: 'TypeError',
      message: 'boom',
      stack: 'TypeError: boom\n    at a (https://cdn.test/app.min.js:1:10)',
    });
    const [group] = await list();
    await owner
      .post(`/workspaces/${ws}/invitations`)
      .send({ email: 'eng@errors.test', role: 'engineer' })
      .expect(201);
    await loginAs(app, 'eng@errors.test');
    const members = (await owner.get(`/workspaces/${ws}/members`).expect(200)).body as {
      userId: string;
      email: string;
    }[];
    const eng = members.find((m) => m.email === 'eng@errors.test')!;
    const assigned = (
      await owner
        .patch(`/workspaces/${ws}/errors/${group!.id}`)
        .send({ assigneeId: eng.userId })
        .expect(200)
    ).body as ErrorGroupView;
    expect(assigned.assignee).toMatchObject({ userId: eng.userId, email: 'eng@errors.test' });
    expect(await list({ assignee: 'none' })).toHaveLength(0);
    await owner
      .patch(`/workspaces/${ws}/errors/${group!.id}`)
      .send({ assigneeId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);

    const releases = (await owner.get(`/workspaces/${ws}/errors/releases`).expect(200)).body as {
      release: string;
      events: number;
      newErrors: number;
    }[];
    expect(releases).toEqual([
      expect.objectContaining({ release: '2.0.0', events: 1, newErrors: 1 }),
    ]);

    const map = JSON.stringify({
      version: 3,
      sources: ['src/price.ts'],
      names: ['computePrice'],
      mappings: 'AAAA,SAASA',
    });
    await owner
      .post(`/workspaces/${ws}/source-maps`)
      .send({ release: '2.0.0', file: 'https://cdn.test/app.min.js', map })
      .expect(201);
    await owner
      .post(`/workspaces/${ws}/source-maps`)
      .send({ release: '2.0.0', file: 'bad.js', map: '{"x":1}' })
      .expect(400);
    const detail = (await owner.get(`/workspaces/${ws}/errors/${group!.id}`).expect(200))
      .body as ErrorGroupDetail;
    expect(detail.symbolicated?.[0]).toBe('    at computePrice (src/price.ts:1:10)');
  });
});
