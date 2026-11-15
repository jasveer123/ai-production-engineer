import { eq } from 'drizzle-orm';
import type { Severity } from '@ape/api-contracts';
import type { Tx } from '../../../core/db/client';
import { deliveryAttempts, users, workspaceMembers } from '../../../core/db/schema';

export interface ReportedIncident {
  id: string;
  workspaceId: string;
  title: string;
  severity: Severity;
  status: string;
  serviceName: string | null;
  environment: string | null;
}

// Hook into the notifications module: queued rows in its delivery ledger are sent by its worker,
// which records the true provider outcome on the same row.
export async function notifyWholeTeam(
  tx: Tx,
  incident: ReportedIncident,
  webUrl: string,
): Promise<number> {
  const members = await tx
    .select({ userId: users.id, email: users.email, name: users.name })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, incident.workspaceId));
  if (members.length === 0) return 0;
  const occurredAt = new Date().toISOString();
  await tx
    .insert(deliveryAttempts)
    .values(
      members.map((m) => ({
        workspaceId: incident.workspaceId,
        incidentId: incident.id,
        userId: m.userId,
        dedupKey: `incident-reported:${incident.id}:${m.userId}`,
        eventType: 'incident.detected',
        channel: 'email',
        address: m.email,
        recipientName: m.name,
        payload: {
          type: 'incident.detected',
          key: `incident-reported:${incident.id}`,
          occurredAt,
          summary: `New incident reported: ${incident.title}`,
          incident: { ...incident },
          url: `${webUrl}/incidents/${incident.id}`,
        },
      })),
    )
    .onConflictDoNothing();
  return members.length;
}
