import type { INestApplication } from '@nestjs/common';
import type { Member, OncallNow, ScheduleView } from '@ape/api-contracts';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

const HOUR = 3_600_000;

describe('On-call schedules (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase());
  afterAll(() => app.close());

  async function setup() {
    const owner = await loginAs(app, 'owner@oncall.test');
    const ws = (await createWorkspace(owner, 'Oncall')).id;
    for (const [email, role] of [
      ['ana@oncall.test', 'engineer'],
      ['bo@oncall.test', 'viewer'],
    ] as const)
      await owner.post(`/workspaces/${ws}/invitations`).send({ email, role }).expect(201);
    const ana = await loginAs(app, 'ana@oncall.test');
    const bo = await loginAs(app, 'bo@oncall.test');
    const members = (await owner.get(`/workspaces/${ws}/members`).expect(200)).body as Member[];
    const id = (email: string) => members.find((m) => m.email === email)!.userId;
    return { owner, ana, bo, ws, anaId: id('ana@oncall.test'), boId: id('bo@oncall.test') };
  }

  const make = (
    agent: ReturnType<typeof request.agent>,
    ws: string,
    participantIds: string[],
    extra = {},
  ) =>
    agent.post(`/workspaces/${ws}/oncall/schedules`).send({
      name: 'Primary',
      rotationHours: 24,
      anchorAt: new Date(Date.now() - HOUR).toISOString(),
      participantIds,
      ...extra,
    });

  it('rotates people, lists upcoming shifts and answers who is on call now', async () => {
    const { owner, ws, anaId, boId } = await setup();
    const created = (await make(owner, ws, [anaId, boId]).expect(201)).body as ScheduleView;
    expect(created.current!.person.userId).toBe(anaId);
    expect(created.current!.override).toBe(false);
    expect(created.participants.map((p) => p.userId)).toEqual([anaId, boId]);
    expect(created.upcoming.length).toBeGreaterThanOrEqual(14);
    expect(created.upcoming[1]!.person.userId).toBe(boId);
    expect(created.upcoming[2]!.person.userId).toBe(anaId);

    const now = (await owner.get(`/workspaces/${ws}/oncall/now`).expect(200)).body as OncallNow[];
    expect(now).toHaveLength(1);
    expect(now[0]).toMatchObject({ scheduleName: 'Primary' });
    expect(now[0]!.shift!.person.userId).toBe(anaId);
  });

  it('lets an engineer swap a shift with an override and refuses overlaps', async () => {
    const { owner, ana, ws, anaId, boId } = await setup();
    const schedule = (await make(owner, ws, [anaId, boId]).expect(201)).body as ScheduleView;
    const window = {
      userId: boId,
      startsAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      endsAt: new Date(Date.now() + 2 * HOUR).toISOString(),
    };
    const swapped = (
      await ana
        .post(`/workspaces/${ws}/oncall/schedules/${schedule.id}/overrides`)
        .send(window)
        .expect(201)
    ).body as ScheduleView;
    expect(swapped.current).toMatchObject({ override: true });
    expect(swapped.current!.person.userId).toBe(boId);
    expect(swapped.overrides).toHaveLength(1);

    await ana
      .post(`/workspaces/${ws}/oncall/schedules/${schedule.id}/overrides`)
      .send({ ...window, userId: anaId })
      .expect(409);

    await ana.delete(`/workspaces/${ws}/oncall/overrides/${swapped.overrides[0]!.id}`).expect(204);
    const back = (await owner.get(`/workspaces/${ws}/oncall/schedules`).expect(200))
      .body as ScheduleView[];
    expect(back[0]!.current!.person.userId).toBe(anaId);
    expect(back[0]!.overrides).toEqual([]);
  });

  it('checks roles, members and input', async () => {
    const { owner, bo, ws, anaId, boId } = await setup();
    await make(bo, ws, [anaId]).expect(403);
    const schedule = (await make(owner, ws, [anaId]).expect(201)).body as ScheduleView;
    await bo
      .post(`/workspaces/${ws}/oncall/schedules/${schedule.id}/overrides`)
      .send({
        userId: boId,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + HOUR).toISOString(),
      })
      .expect(403);

    const stranger = await loginAs(app, 'stranger@oncall.test');
    const otherWs = (await createWorkspace(stranger, 'Other')).id;
    const strangerId = (
      (await stranger.get(`/workspaces/${otherWs}/members`).expect(200)).body as Member[]
    )[0]!.userId;
    await make(owner, ws, [strangerId]).expect(400);
    await make(owner, ws, []).expect(400);
    await owner
      .post(`/workspaces/${ws}/oncall/schedules/${schedule.id}/overrides`)
      .send({
        userId: anaId,
        startsAt: new Date(Date.now() + HOUR).toISOString(),
        endsAt: new Date().toISOString(),
      })
      .expect(400);
  });

  it('updates and deletes a schedule and keeps schedules per workspace', async () => {
    const { owner, ws, anaId, boId } = await setup();
    const schedule = (await make(owner, ws, [anaId]).expect(201)).body as ScheduleView;
    const updated = (
      await owner
        .patch(`/workspaces/${ws}/oncall/schedules/${schedule.id}`)
        .send({ name: 'Weekend', participantIds: [boId, anaId], rotationHours: 48 })
        .expect(200)
    ).body as ScheduleView;
    expect(updated).toMatchObject({ name: 'Weekend', rotationHours: 48 });
    expect(updated.participants.map((p) => p.userId)).toEqual([boId, anaId]);

    const other = await loginAs(app, 'other@oncall.test');
    const otherWs = (await createWorkspace(other, 'Other')).id;
    expect((await other.get(`/workspaces/${otherWs}/oncall/schedules`).expect(200)).body).toEqual(
      [],
    );
    await other
      .patch(`/workspaces/${otherWs}/oncall/schedules/${schedule.id}`)
      .send({ name: 'x' })
      .expect(404);
    await request(app.getHttpServer()).get(`/workspaces/${ws}/oncall/schedules`).expect(401);

    await owner.delete(`/workspaces/${ws}/oncall/schedules/${schedule.id}`).expect(204);
    expect((await owner.get(`/workspaces/${ws}/oncall/schedules`).expect(200)).body).toEqual([]);
  });

  it('accepts exactly one of many concurrent overlapping overrides', async () => {
    const { owner, ws, anaId, boId } = await setup();
    const schedule = (await make(owner, ws, [anaId]).expect(201)).body as ScheduleView;
    const start = Date.now() + 2 * HOUR;
    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        owner.post(`/workspaces/${ws}/oncall/schedules/${schedule.id}/overrides`).send({
          userId: i % 2 ? anaId : boId,
          startsAt: new Date(start + i * 60_000).toISOString(),
          endsAt: new Date(start + HOUR + i * 60_000).toISOString(),
        }),
      ),
    );
    expect(attempts.filter((r) => r.status === 201)).toHaveLength(1);
    expect(attempts.filter((r) => r.status === 409)).toHaveLength(7);
  });

  it('reports coverage with gaps and serves a revocable calendar feed', async () => {
    const { owner, ws, anaId } = await setup();
    const schedule = (
      await make(owner, ws, [], {
        timezone: 'Europe/Berlin',
        participantIds: [],
        layers: [
          {
            id: 'office',
            name: 'Office',
            rotation: {
              kind: 'calendar',
              lengthDays: 7,
              startDate: '2026-11-02',
              handoffTime: '09:00',
            },
            participantIds: [anaId],
            restrictions: [{ days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }],
          },
        ],
      }).expect(201)
    ).body as ScheduleView;
    const coverage = (
      await owner
        .get(`/workspaces/${ws}/oncall/schedules/${schedule.id}/coverage`)
        .query({ from: '2026-11-06T00:00:00Z', to: '2026-11-07T00:00:00Z' })
        .expect(200)
    ).body as { intervals: { startsAt: string }[]; gaps: { startsAt: string }[] };
    expect(coverage.intervals.map((i) => i.startsAt)).toEqual(['2026-11-06T08:00:00.000Z']);
    expect(coverage.gaps).toHaveLength(2);

    const link = (
      await owner
        .post(`/workspaces/${ws}/oncall/schedules/${schedule.id}/calendar-link`)
        .expect(200)
    ).body as { url: string };
    const path = new URL(link.url).pathname + new URL(link.url).search;
    const feed = await request(app.getHttpServer()).get(path).expect(200);
    expect(feed.text).toContain('BEGIN:VCALENDAR');
    await owner
      .delete(`/workspaces/${ws}/oncall/schedules/${schedule.id}/calendar-link`)
      .expect(204);
    await request(app.getHttpServer()).get(path).expect(404);
  });
});
