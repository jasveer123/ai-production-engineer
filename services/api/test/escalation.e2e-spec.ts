import type { INestApplication } from '@nestjs/common';
import type { EscalationRunView, Incident, Member, PolicyView } from '@ape/api-contracts';
import type { App } from 'supertest/types';
import { Mailer } from '../src/modules/auth/infrastructure/mailer.service';
import { EscalationService } from '../src/modules/escalation/application/escalation.service';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

const MIN = 60_000;

describe('Escalation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase());
  afterAll(() => app.close());

  async function setup() {
    const owner = await loginAs(app, 'owner@esc.test');
    const ws = (await createWorkspace(owner, 'Esc')).id;
    for (const email of ['ana@esc.test', 'bo@esc.test'])
      await owner
        .post(`/workspaces/${ws}/invitations`)
        .send({ email, role: 'engineer' })
        .expect(201);
    const ana = await loginAs(app, 'ana@esc.test');
    await loginAs(app, 'bo@esc.test');
    const members = (await owner.get(`/workspaces/${ws}/members`).expect(200)).body as Member[];
    const id = (email: string) => members.find((m) => m.email === email)!.userId;
    return { owner, ana, ws, anaId: id('ana@esc.test'), boId: id('bo@esc.test') };
  }

  it('emails each step in turn and stops once the incident is acknowledged', async () => {
    const { owner, ana, ws, anaId, boId } = await setup();
    const policy = (
      await owner
        .post(`/workspaces/${ws}/escalation/policies`)
        .send({
          name: 'Critical',
          minSeverity: 'high',
          steps: [
            { waitMinutes: 0, targets: [{ kind: 'user', userId: anaId }] },
            { waitMinutes: 5, targets: [{ kind: 'user', userId: boId }] },
          ],
        })
        .expect(201)
    ).body as PolicyView;
    expect(policy.steps[0]!.targets[0]!.label).toBeTruthy();

    const low = (
      await owner
        .post(`/workspaces/${ws}/incidents`)
        .send({ title: 'Minor', severity: 'low' })
        .expect(201)
    ).body as Incident;
    const high = (
      await owner
        .post(`/workspaces/${ws}/incidents`)
        .send({ title: 'Checkout down', severity: 'high' })
        .expect(201)
    ).body as Incident;

    const mailer = app.get(Mailer);
    const escalation = app.get(EscalationService);
    mailer.sent.length = 0;
    const start = new Date();

    expect(await escalation.tick(start)).toMatchObject({ started: 1, stepsRun: 1 });
    expect(mailer.sent.map((m) => m.to)).toEqual(['ana@esc.test']);
    expect(mailer.sent[0]!.subject).toContain('Checkout down');

    expect(await escalation.tick(new Date(start.getTime() + MIN))).toMatchObject({ stepsRun: 0 });

    await ana.post(`/workspaces/${ws}/incidents/${high.id}/acknowledge`).expect(200);
    expect(await escalation.tick(new Date(start.getTime() + 6 * MIN))).toMatchObject({
      stepsRun: 0,
    });
    expect(mailer.sent).toHaveLength(1);

    const runs = (await owner.get(`/workspaces/${ws}/escalation/runs`).expect(200))
      .body as EscalationRunView[];
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ state: 'acknowledged', incidentId: high.id });
    expect(runs[0]!.deliveries).toHaveLength(1);
    expect(runs[0]!.deliveries[0]).toMatchObject({ channel: 'email', address: 'ana@esc.test' });
    expect(runs.some((r) => r.incidentId === low.id)).toBe(false);
  });

  it('moves to the next step when nobody acknowledges', async () => {
    const { owner, ws, anaId, boId } = await setup();
    await owner
      .post(`/workspaces/${ws}/escalation/policies`)
      .send({
        name: 'Chain',
        steps: [
          { waitMinutes: 0, targets: [{ kind: 'user', userId: anaId }] },
          { waitMinutes: 5, targets: [{ kind: 'user', userId: boId }] },
        ],
      })
      .expect(201);
    await owner
      .post(`/workspaces/${ws}/incidents`)
      .send({ title: 'Down', severity: 'critical' })
      .expect(201);
    const mailer = app.get(Mailer);
    const escalation = app.get(EscalationService);
    mailer.sent.length = 0;
    const start = new Date();
    await escalation.tick(start);
    await escalation.tick(new Date(start.getTime() + 6 * MIN));
    expect(mailer.sent.map((m) => m.to)).toEqual(['ana@esc.test', 'bo@esc.test']);
    const runs = (await owner.get(`/workspaces/${ws}/escalation/runs`).expect(200))
      .body as EscalationRunView[];
    expect(runs[0]).toMatchObject({ state: 'completed', stepsDone: 2 });
  });

  it('falls back to e-mailing the whole team when no policy exists', async () => {
    const { owner, ws } = await setup();
    await owner
      .post(`/workspaces/${ws}/incidents`)
      .send({ title: 'Payments down', severity: 'critical' })
      .expect(201);
    const mailer = app.get(Mailer);
    mailer.sent.length = 0;
    expect(await app.get(EscalationService).tick(new Date())).toMatchObject({ started: 1 });
    expect(mailer.sent.map((m) => m.to).sort()).toEqual([
      'ana@esc.test',
      'bo@esc.test',
      'owner@esc.test',
    ]);
    const runs = (await owner.get(`/workspaces/${ws}/escalation/runs`).expect(200))
      .body as EscalationRunView[];
    expect(runs[0]).toMatchObject({ policySource: 'builtin', policyId: null });
  });

  it('rejects targets outside the workspace', async () => {
    const { owner, ws } = await setup();
    await owner
      .post(`/workspaces/${ws}/escalation/policies`)
      .send({
        name: 'Bad',
        steps: [
          {
            waitMinutes: 0,
            targets: [{ kind: 'user', userId: '00000000-0000-4000-8000-000000000000' }],
          },
        ],
      })
      .expect(404);
  });
});
