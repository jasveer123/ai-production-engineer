import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type {
  CreateErrorAppInput,
  ErrorAppView,
  ErrorPlatform,
  UpdateErrorAppInput,
} from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { errorApplications, errorGroups } from '../../../core/db/schema';

type Row = typeof errorApplications.$inferSelect;

export function dsnFor(publicApiUrl: string, publicKey: string, projectId: number): string {
  const url = new URL(publicApiUrl);
  return `${url.protocol}//${publicKey}@${url.host}${url.pathname.replace(/\/+$/, '')}/${projectId}`;
}

@Injectable()
export class ErrorAppsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  private view(r: Row): ErrorAppView {
    return {
      id: r.id,
      name: r.name,
      platform: r.platform as ErrorPlatform,
      publicKey: r.publicKey,
      projectId: r.projectId,
      dsn: dsnFor(this.env.PUBLIC_API_URL, r.publicKey, r.projectId),
      rateLimitPerMinute: r.rateLimitPerMinute,
      droppedEvents: r.droppedEvents,
      lastEventAt: r.lastEventAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async list(actor: ActorContext): Promise<ErrorAppView[]> {
    const rows = await this.db
      .select()
      .from(errorApplications)
      .where(eq(errorApplications.workspaceId, actor.workspaceId))
      .orderBy(asc(errorApplications.createdAt));
    return rows.map((r) => this.view(r));
  }

  async create(actor: ActorContext, input: CreateErrorAppInput): Promise<ErrorAppView> {
    const [row] = await this.db
      .insert(errorApplications)
      .values({
        workspaceId: actor.workspaceId,
        name: input.name,
        platform: input.platform,
        publicKey: randomBytes(16).toString('hex'),
      })
      .returning();
    return this.view(row!);
  }

  async update(actor: ActorContext, id: string, input: UpdateErrorAppInput): Promise<ErrorAppView> {
    const [row] = await this.db
      .update(errorApplications)
      .set({ rateLimitPerMinute: input.rateLimitPerMinute })
      .where(
        and(eq(errorApplications.id, id), eq(errorApplications.workspaceId, actor.workspaceId)),
      )
      .returning();
    if (!row) throw notFound('Application');
    return this.view(row);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const removed = await tx
        .delete(errorApplications)
        .where(
          and(eq(errorApplications.id, id), eq(errorApplications.workspaceId, actor.workspaceId)),
        )
        .returning({ id: errorApplications.id });
      if (removed.length === 0) throw notFound('Application');
      await tx
        .update(errorGroups)
        .set({ applicationId: null })
        .where(
          and(eq(errorGroups.workspaceId, actor.workspaceId), eq(errorGroups.applicationId, id)),
        );
    });
  }
}
