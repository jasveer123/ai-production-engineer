import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { and, asc, desc, eq, gt, gte, lt, or, type SQL } from 'drizzle-orm';
import {
  deploymentListQuerySchema,
  type Deployment,
  type DeploymentDetail,
  type DeploymentListQuery,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { notFound } from '../../core/common/errors';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { DB } from '../../core/db/database.module';
import type { Database } from '../../core/db/client';
import { deployments, incidents, integrations, services } from '../../core/db/schema';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';

@Controller('workspaces/:workspaceId/deployments')
@UseGuards(WorkspaceAccessGuard)
export class DeploymentsController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get()
  async list(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(deploymentListQuerySchema)) q: DeploymentListQuery,
  ): Promise<Deployment[]> {
    const where: SQL[] = [eq(deployments.workspaceId, actor.workspaceId)];
    if (q.service) where.push(eq(deployments.serviceName, q.service));
    if (q.environment) where.push(eq(deployments.environment, q.environment));
    if (q.before) where.push(lt(deployments.deployedAt, new Date(q.before)));
    const rows = await this.select()
      .where(and(...where))
      .orderBy(desc(deployments.deployedAt), desc(deployments.id))
      .limit(q.limit ?? 50);
    return rows.map(toDto);
  }

  @Get(':deploymentId')
  async get(
    @Actor() actor: ActorContext,
    @Param('deploymentId', ParseUUIDPipe) id: string,
  ): Promise<DeploymentDetail> {
    const [row] = await this.select().where(
      and(eq(deployments.id, id), eq(deployments.workspaceId, actor.workspaceId)),
    );
    if (!row) throw notFound('Deploy');
    const d = row.d;
    const same = and(
      eq(deployments.workspaceId, actor.workspaceId),
      eq(deployments.serviceName, d.serviceName),
      eq(deployments.environment, d.environment),
    );

    const [previous] = await this.select()
      .where(
        and(
          same,
          or(
            lt(deployments.deployedAt, d.deployedAt),
            and(eq(deployments.deployedAt, d.deployedAt), lt(deployments.id, d.id)),
          ),
        ),
      )
      .orderBy(desc(deployments.deployedAt), desc(deployments.id))
      .limit(1);
    const [next] = await this.select()
      .where(
        and(
          same,
          or(
            gt(deployments.deployedAt, d.deployedAt),
            and(eq(deployments.deployedAt, d.deployedAt), gt(deployments.id, d.id)),
          ),
        ),
      )
      .orderBy(asc(deployments.deployedAt), asc(deployments.id))
      .limit(1);
    const opened = await this.db
      .select({
        id: incidents.id,
        title: incidents.title,
        severity: incidents.severity,
        status: incidents.status,
        firstSeenAt: incidents.firstSeenAt,
      })
      .from(incidents)
      .where(
        and(
          eq(incidents.workspaceId, actor.workspaceId),
          eq(incidents.serviceName, d.serviceName),
          eq(incidents.environment, d.environment),
          gte(incidents.firstSeenAt, d.deployedAt),
          ...(next ? [lt(incidents.firstSeenAt, next.d.deployedAt)] : []),
        ),
      )
      .orderBy(asc(incidents.firstSeenAt))
      .limit(50);
    const [service] = d.serviceId
      ? await this.db
          .select({ repo: services.repositoryFullName })
          .from(services)
          .where(eq(services.id, d.serviceId))
      : [];
    return {
      ...toDto(row),
      previous: previous ? toDto(previous) : null,
      next: next ? toDto(next) : null,
      incidents: opened.map((i) => ({ ...i, firstSeenAt: i.firstSeenAt.toISOString() })),
      repositoryFullName: service?.repo ?? null,
    };
  }

  private select() {
    return this.db
      .select({ d: deployments, integrationName: integrations.name })
      .from(deployments)
      .leftJoin(integrations, eq(integrations.id, deployments.integrationId));
  }
}

function toDto({
  d,
  integrationName,
}: {
  d: typeof deployments.$inferSelect;
  integrationName: string | null;
}): Deployment {
  return {
    id: d.id,
    serviceId: d.serviceId,
    serviceName: d.serviceName,
    environment: d.environment,
    commitSha: d.commitSha,
    version: d.version,
    deployedAt: d.deployedAt.toISOString(),
    integrationName,
  };
}
