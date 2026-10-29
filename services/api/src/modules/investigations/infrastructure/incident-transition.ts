import { eq } from 'drizzle-orm';
import type { AuditService } from '../../../core/audit/audit.service';
import type { Tx } from '../../../core/db/client';
import { incidentEvents, incidents, type IncidentStatus } from '../../../core/db/schema';
import { canTransition } from '../../incidents/domain/lifecycle';

export interface IncidentChange {
  incidentId: string;
  to: IncidentStatus;
  summary: string;
  actorId: string | null;
  correlationId: string;
}

export async function transitionIncident(
  tx: Tx,
  audit: AuditService,
  change: IncidentChange,
): Promise<void> {
  const { incidentId, to, summary, actorId, correlationId } = change;
  const [inc] = await tx.select().from(incidents).where(eq(incidents.id, incidentId)).for('update');
  if (!inc || !canTransition(inc.status, to)) return;
  await tx
    .update(incidents)
    .set({ status: to, version: inc.version + 1 })
    .where(eq(incidents.id, incidentId));
  await tx.insert(incidentEvents).values({
    workspaceId: inc.workspaceId,
    incidentId,
    kind: 'status_change',
    source: actorId ? 'user' : 'workflow',
    occurredAt: new Date(),
    actorId,
    summary: `Status changed from ${inc.status} to ${to}. ${summary}`.trim(),
    attributes: { from: inc.status, to, reason: summary },
  });
  await audit.record(
    {
      workspaceId: inc.workspaceId,
      actorId,
      actorType: actorId ? 'user' : 'agent',
      action: 'incident.status_changed',
      resourceType: 'incident',
      resourceId: incidentId,
      outcome: 'success',
      correlationId,
      metadata: { from: inc.status, to, reason: summary },
    },
    tx,
  );
}
