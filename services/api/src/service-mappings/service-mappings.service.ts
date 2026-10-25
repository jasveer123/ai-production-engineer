import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, max } from 'drizzle-orm';
import type {
  CreateServiceInput,
  DiscoveredService,
  Service,
  UpdateServiceInput,
} from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { incidents, ingestStreams, services } from '../db/schema';
import type { ActorContext } from '../common/request-context';
import { conflict, isUniqueViolation, notFound } from '../common/errors';

type Row = typeof services.$inferSelect;
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Incidents opened before their service was set up keep no link to it, so the AI could never read
 * their code. Link every unlinked incident that reports this service name and environment.
 */
async function linkIncidents(tx: Tx, service: Row): Promise<void> {
  await tx
    .update(incidents)
    .set({ serviceId: service.id })
    .where(
      and(
        eq(incidents.workspaceId, service.workspaceId),
        eq(incidents.serviceName, service.name),
        eq(incidents.environment, service.environment),
        isNull(incidents.serviceId),
      ),
    );
}

const toDto = (r: Row): Service => ({
  id: r.id,
  name: r.name,
  environment: r.environment,
  repositoryFullName: r.repositoryFullName,
  defaultBranch: r.defaultBranch,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/** Service ↔ repository ↔ environment mappings (FR-03). Every query is scoped by workspace. */
@Injectable()
export class ServiceMappingsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(actor: ActorContext): Promise<Service[]> {
    const rows = await this.db
      .select()
      .from(services)
      .where(eq(services.workspaceId, actor.workspaceId))
      .orderBy(asc(services.name), asc(services.environment));
    return rows.map(toDto);
  }

  /** Service names that telemetry reports but no mapping covers yet, newest first. Read-only. */
  async discovered(actor: ActorContext): Promise<DiscoveredService[]> {
    const lastReceivedAt = max(ingestStreams.lastReceivedAt);
    const rows = await this.db
      .select({
        name: ingestStreams.serviceName,
        environment: ingestStreams.environment,
        lastReceivedAt,
      })
      .from(ingestStreams)
      .leftJoin(
        services,
        and(
          eq(services.workspaceId, ingestStreams.workspaceId),
          eq(services.name, ingestStreams.serviceName),
          eq(services.environment, ingestStreams.environment),
        ),
      )
      .where(and(eq(ingestStreams.workspaceId, actor.workspaceId), isNull(services.id)))
      .groupBy(ingestStreams.serviceName, ingestStreams.environment)
      .orderBy(desc(lastReceivedAt));
    return rows.map((r) => ({
      name: r.name,
      environment: r.environment,
      lastReceivedAt: (r.lastReceivedAt ?? new Date(0)).toISOString(),
    }));
  }

  async get(actor: ActorContext, id: string): Promise<Service> {
    const [row] = await this.db
      .select()
      .from(services)
      .where(and(eq(services.id, id), eq(services.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Service');
    return toDto(row);
  }

  async create(actor: ActorContext, input: CreateServiceInput): Promise<Service> {
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(services)
          .values({
            workspaceId: actor.workspaceId,
            name: input.name,
            environment: input.environment,
            repositoryFullName: input.repositoryFullName ?? null,
            defaultBranch: input.defaultBranch ?? 'main',
          })
          .returning();
        await linkIncidents(tx, row!);
        await this.audit.record(
          {
            workspaceId: actor.workspaceId,
            actorId: actor.userId,
            action: 'service.created',
            resourceType: 'service',
            resourceId: row!.id,
            outcome: 'success',
            correlationId: actor.correlationId,
            metadata: { ...input },
          },
          tx,
        );
        return toDto(row!);
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('A service with this name and environment exists');
      throw err;
    }
  }

  async update(actor: ActorContext, id: string, input: UpdateServiceInput): Promise<Service> {
    try {
      return await this.db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(services)
          .where(and(eq(services.id, id), eq(services.workspaceId, actor.workspaceId)))
          .for('update');
        if (!before) throw notFound('Service');
        const [row] = await tx
          .update(services)
          .set(input)
          .where(and(eq(services.id, id), eq(services.workspaceId, actor.workspaceId)))
          .returning();
        await linkIncidents(tx, row!);
        await this.audit.record(
          {
            workspaceId: actor.workspaceId,
            actorId: actor.userId,
            action: 'service.updated',
            resourceType: 'service',
            resourceId: id,
            outcome: 'success',
            correlationId: actor.correlationId,
            metadata: { before: toDto(before), changes: input },
          },
          tx,
        );
        return toDto(row!);
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('A service with this name and environment exists');
      throw err;
    }
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .delete(services)
        .where(and(eq(services.id, id), eq(services.workspaceId, actor.workspaceId)))
        .returning();
      if (!row) throw notFound('Service');
      await this.audit.record(
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: 'service.deleted',
          resourceType: 'service',
          resourceId: id,
          outcome: 'success',
          correlationId: actor.correlationId,
          metadata: { name: row.name, environment: row.environment },
        },
        tx,
      );
    });
  }
}
