import type { AuditService } from '../audit/audit.service';
import type { Database, Tx } from '../db/client';
import { incidentEvents, incidents, outbox, type Severity } from '../db/schema';

export interface NewIncident {
  workspaceId: string;
  serviceId: string | null;
  serviceName: string | null;
  environment: string | null;
  source: string;
  title: string;
  fingerprint: string;
  severity: Severity;
  occurredAt: Date;
  /** Timeline text for the `created` event. */
  summary: string;
  correlationId: string;
}

/**
 * Opens an incident inside the caller's transaction, with its `created` timeline event, the
 * outbox row that starts the investigation workflow, and the audit record. Used for incidents
 * from error traces and from alerts alike, so both behave the same downstream.
 */
export async function openIncident(tx: Tx, audit: AuditService, n: NewIncident): Promise<string> {
  const [created] = await tx
    .insert(incidents)
    .values({
      workspaceId: n.workspaceId,
      serviceId: n.serviceId,
      serviceName: n.serviceName,
      environment: n.environment,
      source: n.source,
      title: n.title,
      fingerprint: n.fingerprint,
      severity: n.severity,
      firstSeenAt: n.occurredAt,
      lastSeenAt: n.occurredAt,
    })
    .returning({ id: incidents.id });
  const incidentId = created!.id;
  await tx.insert(incidentEvents).values({
    workspaceId: n.workspaceId,
    incidentId,
    kind: 'created',
    source: n.source,
    occurredAt: n.occurredAt,
    summary: n.summary,
  });
  await tx.insert(outbox).values({
    workspaceId: n.workspaceId,
    topic: 'incident.detected',
    payload: { incidentId, workspaceId: n.workspaceId },
  });
  await audit.record(
    {
      workspaceId: n.workspaceId,
      actorType: 'system',
      action: 'incident.created',
      resourceType: 'incident',
      resourceId: incidentId,
      outcome: 'success',
      correlationId: n.correlationId,
      metadata: { source: n.source, fingerprint: n.fingerprint },
    },
    tx,
  );
  return incidentId;
}
