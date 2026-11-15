import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { Incident } from '@ape/api-contracts';
import type { Database } from '../../../core/db/client';
import { deployments } from '../../../core/db/schema';

const DEPLOY_LOOKBACK_MS = 24 * 60 * 60_000;

export interface DeployEntry {
  kind: 'deploy';
  id: string;
  at: string;
  source: string;
  summary: string;
  commitSha: string;
  version: string | null;
  environment: string;
}

export async function incidentDeploys(
  db: Database,
  workspaceId: string,
  incident: Pick<Incident, 'serviceName' | 'environment' | 'firstSeenAt' | 'lastSeenAt'>,
): Promise<DeployEntry[]> {
  if (!incident.serviceName || !incident.environment) return [];
  const rows = await db
    .select()
    .from(deployments)
    .where(
      and(
        eq(deployments.workspaceId, workspaceId),
        eq(deployments.serviceName, incident.serviceName),
        eq(deployments.environment, incident.environment),
        gte(
          deployments.deployedAt,
          new Date(Date.parse(incident.firstSeenAt) - DEPLOY_LOOKBACK_MS),
        ),
        lte(
          deployments.deployedAt,
          new Date(Math.max(Date.parse(incident.lastSeenAt), Date.now())),
        ),
      ),
    )
    .orderBy(desc(deployments.deployedAt))
    .limit(20);
  return rows.map((d) => ({
    kind: 'deploy',
    id: d.id,
    at: d.deployedAt.toISOString(),
    source: 'deploy_webhook',
    summary: `Deployed ${d.serviceName}${d.version ? ` ${d.version}` : ''} to ${d.environment}`,
    commitSha: d.commitSha,
    version: d.version,
    environment: d.environment,
  }));
}
