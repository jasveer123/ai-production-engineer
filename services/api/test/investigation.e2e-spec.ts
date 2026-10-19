import type { INestApplication } from '@nestjs/common';
import { Connection } from '@temporalio/client';
import { NativeConnection, Worker } from '@temporalio/worker';
import {
  TASK_QUEUES,
  type InvestigateInput,
  type InvestigateResult,
} from '@ape/temporal-workflows';
import type { Incident, IncidentInvestigation } from '@ape/api-contracts';
import { eq } from 'drizzle-orm';
import type { App } from 'supertest/types';
import { ArtifactStore } from '../src/artifacts/artifact-store.service';
import { createDatabase } from '../src/db/client';
import { approvals, inboundEvents, incidents, outbox } from '../src/db/schema';
import { IngestionProcessor } from '../src/ingestion/ingestion.processor';
import { extractError, type JaegerTrace } from '../src/ingestion/jaeger';
import { JaegerPoller } from '../src/ingestion/jaeger.poller';
import { FixActivitiesService } from '../src/fixes/fix-activities.service';
import { InvestigationActivities } from '../src/investigations/investigation-activities.service';
import { OutboxPublisher } from '../src/temporal/outbox-publisher.service';
import s1 from './fixtures/jaeger-trace-s1.json';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

const trace = s1 as unknown as JaegerTrace;
const NAMESPACE = process.env.TEMPORAL_NAMESPACE!;
const ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
jest.setTimeout(120_000);

/** Stand-in for the Python `investigate` activity: cites E1 (real) and E99 (made up). */
function fakeInvestigate(store: Map<string, unknown>) {
  return (input: InvestigateInput): Promise<InvestigateResult> => {
    const ref = `s3://test/reports/${input.investigationId}.json`;
    store.set(ref, {
      status: 'completed',
      reason: null,
      model: 'fake-model',
      prompt_version: input.promptVersion,
      observations: [{ statement: 'discountV2 throws', evidence: ['E1'] }],
      hypotheses: [
        {
          rank: 1,
          summary: 'Undefined coupon dereferenced in discountV2',
          confidence: 'high',
          confidence_rationale: 'stack frame',
          supporting_evidence: ['E1'],
          contradicting_evidence: [],
          missing_information: [],
          suspected_location: {
            file: 'api/src/services/checkout.ts',
            line: 81,
            symbol: 'discountV2',
          },
        },
        {
          rank: 2,
          summary: 'Invented cause',
          confidence: 'low',
          confidence_rationale: 'none',
          supporting_evidence: ['E99'],
          contradicting_evidence: [],
          missing_information: [],
          suspected_location: null,
        },
      ],
      data_gaps: [],
      rejected: [],
      usage: { input_tokens: 100, output_tokens: 20, cost_usd: 0.0008, latency_ms: 10, calls: 1 },
    });
    return Promise.resolve({
      status: 'completed',
      reason: null,
      reportRef: ref,
      model: 'fake-model',
    });
  };
}

async function ensureNamespace() {
  const conn = await Connection.connect({ address: ADDRESS });
  try {
    await conn.workflowService.registerNamespace({
      namespace: NAMESPACE,
      // protobufjs accepts a plain number for this Long field at runtime.
      workflowExecutionRetentionPeriod: { seconds: 86_400 as never },
    });
    await new Promise((r) => setTimeout(r, 1500)); // namespace propagation on the dev server
  } catch (err) {
    if (!String(err).includes('already')) throw err;
  } finally {
    await conn.close();
  }
}

async function until<T>(fn: () => Promise<T | undefined | null | false>, ms = 60_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('Timed out waiting');
    await new Promise((r) => setTimeout(r, 300));
  }
}

describe('AI investigation workflow (e2e, needs a Temporal server)', () => {
  let app: INestApplication<App>;
  let workers: Worker[] = [];
  let running: Promise<unknown>[] = [];
  const reports = new Map<string, unknown>();
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);

  beforeAll(async () => {
    await ensureNamespace();
    app = await createTestApp();
    // In-memory object storage and a canned Jaeger trace.
    const store = app.get(ArtifactStore);
    store.putJson = (key: string, data: unknown) => {
      const ref = `s3://test/${key}`;
      reports.set(ref, structuredClone(data));
      return Promise.resolve(ref);
    };
    store.getJson = <T>(ref: string) => Promise.resolve(reports.get(ref) as T);
    jest.spyOn(app.get(JaegerPoller).client, 'getTrace').mockResolvedValue(trace);
    jest.spyOn(app.get(JaegerPoller).client, 'services').mockResolvedValue(['demo-shop-api']);

    const acts = app.get(InvestigationActivities);
    const fix = app.get(FixActivitiesService);
    const connection = await NativeConnection.connect({ address: ADDRESS });
    workers = await Promise.all([
      Worker.create({
        connection,
        namespace: NAMESPACE,
        taskQueue: TASK_QUEUES.incident,
        workflowsPath: require.resolve('@ape/temporal-workflows/dist/workflows'),
      }),
      Worker.create({
        connection,
        namespace: NAMESPACE,
        taskQueue: TASK_QUEUES.evidence,
        activities: {
          startInvestigation: acts.startInvestigation.bind(acts),
          collectEvidence: acts.collectEvidence.bind(acts),
          publishReport: acts.publishReport.bind(acts),
          markInvestigation: acts.markInvestigation.bind(acts),
          closeIncident: acts.closeIncident.bind(acts),
          recordReproductionApproval: acts.recordReproductionApproval.bind(acts),
          prepareFix: fix.prepareFix.bind(fix),
          recordRun: fix.recordRun.bind(fix),
          applyPatch: fix.applyPatch.bind(fix),
          updateFix: fix.updateFix.bind(fix),
          setIncidentStatus: fix.setIncidentStatus.bind(fix),
          testOverlay: fix.testOverlay.bind(fix),
        },
      }),
      Worker.create({
        connection,
        namespace: NAMESPACE,
        taskQueue: TASK_QUEUES.ai,
        activities: { investigate: fakeInvestigate(reports) },
      }),
    ]);
    running = workers.map((w) => w.run());
  });

  beforeEach(resetDatabase);

  afterAll(async () => {
    workers.forEach((w) => w.shutdown());
    await Promise.allSettled(running);
    await pool.end();
    await app.close();
  });

  async function incidentWithErrors(owner: Awaited<ReturnType<typeof loginAs>>, ws: string) {
    await owner
      .post(`/workspaces/${ws}/services`)
      .send({
        name: 'demo-shop-api',
        environment: 'production',
        repositoryFullName: 'me/demo-shop',
      })
      .expect(201);
    const jaeger = (
      await owner
        .post(`/workspaces/${ws}/integrations`)
        .send({ provider: 'otel_jaeger', name: 'J' })
        .expect(201)
    ).body as { id: string };
    const base = extractError(trace, 'demo-shop-api')!;
    const prefix = Math.random().toString(16).slice(2, 10);
    await db.insert(inboundEvents).values(
      [0, 1, 2].map((i) => ({
        workspaceId: ws,
        integrationId: jaeger.id,
        source: 'otel_jaeger',
        externalEventId: `${prefix}${i}`.padEnd(32, '0'),
        payload: { ...base, traceId: `${prefix}${i}`.padEnd(32, '0') },
      })),
    );
    await app.get(IngestionProcessor).processBatch();
    const [incident] = (await owner.get(`/workspaces/${ws}/incidents`).expect(200))
      .body as Incident[];
    return incident!;
  }

  const investigation = (agent: Awaited<ReturnType<typeof loginAs>>, ws: string, id: string) =>
    agent
      .get(`/workspaces/${ws}/incidents/${id}/investigation`)
      .then((r) => r.body as IncidentInvestigation);

  it('investigates a new incident from the outbox, drops invented citations, then approves reproduction', async () => {
    const owner = await loginAs(app, 'owner@inv.test');
    const ws = (await createWorkspace(owner, 'Investigations')).id;
    const incident = await incidentWithErrors(owner, ws);

    expect(await app.get(OutboxPublisher).publishBatch()).toBe(1);
    const [row] = await db.select().from(outbox).where(eq(outbox.workspaceId, ws));
    expect(row!.publishedAt).not.toBeNull();

    const done = await until(async () => {
      const r = await investigation(owner, ws, incident.id);
      return r.latest?.status === 'completed' && r.workflow?.phase === 'awaiting_decision'
        ? r
        : null;
    });
    const inv = done.latest!;
    expect(inv.evidence.map((e) => e.kind)).toEqual(
      expect.arrayContaining(['error_event', 'trace']),
    );
    expect(inv.coverage.code).toContain('unavailable'); // no GitHub installation: reported, not invented
    expect(inv.hypotheses).toHaveLength(1); // the E99 hypothesis was rejected by the API-side guard
    expect(inv.hypotheses[0]).toMatchObject({
      rank: 1,
      confidence: 'high',
      supportingEvidence: ['E1'],
    });
    expect(inv.usage.cost_usd).toBeCloseTo(0.0008);

    const [inc] = await db.select().from(incidents).where(eq(incidents.id, incident.id));
    expect(inc!.status).toBe('investigating');

    const ev = await owner
      .get(`/workspaces/${ws}/incidents/${incident.id}/evidence/${inv.evidence[0]!.id}`)
      .expect(200);
    expect((ev.body as { content: string }).content).toContain('TypeError');

    await owner
      .post(`/workspaces/${ws}/incidents/${incident.id}/actions`)
      .send({ action: 'approve_reproduction' })
      .expect(200);
    // Workflow B starts; with no GitHub installation it stops before touching any code and waits.
    await until(async () => {
      const r = await investigation(owner, ws, incident.id);
      return r.reproductionApproved && r.workflow?.phase === 'awaiting_fix_decision';
    });
    const fixes = (await owner.get(`/workspaces/${ws}/incidents/${incident.id}/fixes`).expect(200))
      .body as {
      latest: unknown;
      phase: string;
    };
    expect(fixes).toMatchObject({ latest: null, phase: 'awaiting_fix_decision' });
    expect(
      await db.select().from(approvals).where(eq(approvals.resourceId, incident.id)),
    ).toHaveLength(1);
  });

  it('runs another attempt on "investigate further" and closes the incident on dismiss', async () => {
    const owner = await loginAs(app, 'owner2@inv.test');
    const ws = (await createWorkspace(owner, 'Investigations 2')).id;
    const incident = await incidentWithErrors(owner, ws);
    await app.get(OutboxPublisher).publishBatch();
    await until(
      async () =>
        (await investigation(owner, ws, incident.id)).workflow?.phase === 'awaiting_decision',
    );

    await owner
      .post(`/workspaces/${ws}/incidents/${incident.id}/actions`)
      .send({ action: 'investigate', note: 'Check the coupon cache' })
      .expect(200);
    const second = await until(async () => {
      const r = await investigation(owner, ws, incident.id);
      return r.latest?.attempt === 2 && r.workflow?.phase === 'awaiting_decision' ? r : null;
    });
    expect(second.attempts).toBe(2);
    expect(second.latest!.requestNote).toBe('Check the coupon cache');

    await owner
      .post(`/workspaces/${ws}/incidents/${incident.id}/actions`)
      .send({ action: 'dismiss', note: 'Known issue' })
      .expect(200);
    await until(async () => {
      const [inc] = await db.select().from(incidents).where(eq(incidents.id, incident.id));
      return inc!.status === 'closed_without_fix';
    });
  });

  it('rejects approval while no decision is pending', async () => {
    const owner = await loginAs(app, 'owner3@inv.test');
    const ws = (await createWorkspace(owner, 'Investigations 3')).id;
    const incident = await incidentWithErrors(owner, ws);
    const res = await owner
      .post(`/workspaces/${ws}/incidents/${incident.id}/actions`)
      .send({ action: 'approve_reproduction' })
      .expect(409);
    expect((res.body as { code: string }).code).toBe('not_awaiting_decision');
  });
});
