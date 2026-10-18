import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { CreateServiceInput, Service, UpdateServiceInput } from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { services } from '../db/schema';
import type { ActorContext } from '../common/request-context';
import { conflict, isUniqueViolation, notFound } from '../common/errors';

type Row = typeof services.$inferSelect;

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
