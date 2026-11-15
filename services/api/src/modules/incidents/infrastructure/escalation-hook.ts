import { and, eq, inArray, sql } from 'drizzle-orm';
import type { IncidentEscalationView } from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import type { Database, Tx } from '../../../core/db/client';
import { escalationPolicies, escalationRuns } from '../../../core/db/schema';

// Minimal hook into the escalation module: its runner picks up any run whose nextRunAt is due.
type Db = Database | Tx;

async function requirePolicy(db: Db, workspaceId: string, policyId: string): Promise<void> {
  const [policy] = await db
    .select({ id: escalationPolicies.id })
    .from(escalationPolicies)
    .where(
      and(eq(escalationPolicies.id, policyId), eq(escalationPolicies.workspaceId, workspaceId)),
    );
  if (!policy) throw notFound('Escalation policy');
}

export async function startPolicyRun(
  db: Db,
  workspaceId: string,
  incidentId: string,
  policyId: string,
): Promise<void> {
  await requirePolicy(db, workspaceId, policyId);
  await db
    .insert(escalationRuns)
    .values({ workspaceId, incidentId, policyId, nextRunAt: new Date() })
    .onConflictDoNothing();
}

export async function escalateNow(
  db: Db,
  workspaceId: string,
  incidentId: string,
  policyId?: string,
): Promise<number> {
  const now = new Date();
  const running = await db
    .update(escalationRuns)
    .set({ nextRunAt: now })
    .where(
      and(
        eq(escalationRuns.workspaceId, workspaceId),
        eq(escalationRuns.incidentId, incidentId),
        eq(escalationRuns.state, 'running'),
        ...(policyId ? [eq(escalationRuns.policyId, policyId)] : []),
      ),
    )
    .returning({ id: escalationRuns.id });
  if (running.length > 0 || !policyId) return running.length;
  await requirePolicy(db, workspaceId, policyId);
  await db
    .insert(escalationRuns)
    .values({ workspaceId, incidentId, policyId, nextRunAt: now })
    .onConflictDoUpdate({
      target: [escalationRuns.incidentId, escalationRuns.policyId],
      set: { state: 'running', stepIndex: 0, nextRunAt: now, finishedAt: null },
    });
  return 1;
}

// Acknowledgement fence: no new attempts are authorized after a human takes the incident.
export async function stopRuns(
  db: Db,
  workspaceId: string,
  incidentId: string,
  state: 'acknowledged' | 'cancelled',
): Promise<void> {
  await db
    .update(escalationRuns)
    .set({ state, finishedAt: sql`coalesce(${escalationRuns.finishedAt}, now())`, nextRunAt: null })
    .where(
      and(
        eq(escalationRuns.workspaceId, workspaceId),
        eq(escalationRuns.incidentId, incidentId),
        inArray(escalationRuns.state, ['running', 'completed']),
      ),
    );
}

export async function incidentEscalations(
  db: Db,
  workspaceId: string,
  incidentId: string,
): Promise<IncidentEscalationView[]> {
  const rows = await db
    .select({ run: escalationRuns, policyName: escalationPolicies.name })
    .from(escalationRuns)
    .leftJoin(escalationPolicies, eq(escalationPolicies.id, escalationRuns.policyId))
    .where(
      and(eq(escalationRuns.workspaceId, workspaceId), eq(escalationRuns.incidentId, incidentId)),
    );
  return rows.map(({ run, policyName }) => ({
    policyId: run.policyId,
    policyName: policyName ?? 'Escalation',
    state: run.state,
    stepIndex: run.stepIndex,
    nextRunAt: run.nextRunAt?.toISOString() ?? null,
  }));
}
