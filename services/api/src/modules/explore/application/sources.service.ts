import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { SourcesOverview, SourceView } from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { ingestTokens, logRecords } from '../../../core/db/schema';
import { IngestService } from '../../../ingest/collector/application/ingest.service';
import { maskToken } from '../../../ingest/collector/application/ingest-tokens.service';

@Injectable()
export class SourcesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly ingest: IngestService,
    private readonly audit: AuditService,
  ) {}

  async overview(workspaceId: string): Promise<SourcesOverview> {
    const [tokens, volume] = await Promise.all([
      this.db
        .select()
        .from(ingestTokens)
        .where(and(eq(ingestTokens.workspaceId, workspaceId), isNull(ingestTokens.revokedAt)))
        .orderBy(asc(ingestTokens.createdAt)),
      this.db
        .select({
          way: logRecords.way,
          logs: sql<number>`count(*)::int`,
          lastAt: sql<Date | null>`max(${logRecords.ts})`,
        })
        .from(logRecords)
        .where(
          and(
            eq(logRecords.workspaceId, workspaceId),
            gte(logRecords.ts, new Date(Date.now() - 24 * 3600 * 1000)),
          ),
        )
        .groupBy(logRecords.way),
    ]);
    const sources: SourceView[] = tokens.map((t) => ({
      id: t.id,
      name: t.name,
      platform: t.platform,
      masked: maskToken(t.last4),
      createdAt: t.createdAt.toISOString(),
      lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      pausedAt: t.pausedAt?.toISOString() ?? null,
    }));
    return {
      ingestUrl: this.ingest.ingestUrl,
      sources,
      volume24h: volume.map((v) => ({
        way: v.way,
        logs: v.logs,
        lastAt: v.lastAt ? new Date(v.lastAt).toISOString() : null,
      })),
    };
  }

  async setPaused(actor: ActorContext, id: string, paused: boolean): Promise<void> {
    const [row] = await this.db
      .update(ingestTokens)
      .set({ pausedAt: paused ? new Date() : null })
      .where(
        and(
          eq(ingestTokens.id, id),
          eq(ingestTokens.workspaceId, actor.workspaceId),
          isNull(ingestTokens.revokedAt),
        ),
      )
      .returning({ id: ingestTokens.id });
    if (!row) throw notFound('Source');
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: paused ? 'ingest_token.paused' : 'ingest_token.resumed',
      resourceType: 'ingest_token',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: {},
    });
  }
}
