import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { IngestToken, IngestTokenWithSecret } from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { sha256 } from '../../../modules/auth/domain/password';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { ingestTokens } from '../../../core/db/schema';

type Row = typeof ingestTokens.$inferSelect;

export const TOKEN_PREFIX = 'ape_live_';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CACHE_TTL_MS = 60_000;

export function newIngestToken(): string {
  const bytes = randomBytes(48);
  let out = '';
  for (const b of bytes) {
    if (b >= 248) continue;
    out += ALPHABET[b % 62];
    if (out.length === 32) break;
  }
  return out.length === 32 ? TOKEN_PREFIX + out : newIngestToken();
}

export const maskToken = (last4: string) => `${TOKEN_PREFIX}••••••••${last4}`;

@Injectable()
export class IngestTokensService {
  private readonly cache = new Map<
    string,
    { workspaceId: string | null; tokenId: string | null; at: number }
  >();
  private readonly touched = new Map<string, number>();

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  toDto(r: Row): IngestToken {
    return {
      id: r.id,
      name: r.name,
      masked: maskToken(r.last4),
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      revokedAt: r.revokedAt?.toISOString() ?? null,
    };
  }

  async list(workspaceId: string): Promise<IngestToken[]> {
    const rows = await this.db
      .select()
      .from(ingestTokens)
      .where(and(eq(ingestTokens.workspaceId, workspaceId), isNull(ingestTokens.revokedAt)))
      .orderBy(asc(ingestTokens.createdAt));
    return rows.map((r) => this.toDto(r));
  }

  async create(actor: ActorContext, name: string): Promise<IngestTokenWithSecret> {
    const token = newIngestToken();
    const [row] = await this.db
      .insert(ingestTokens)
      .values({
        workspaceId: actor.workspaceId,
        name,
        tokenHash: sha256(token),
        last4: token.slice(-4),
        createdBy: actor.userId,
      })
      .returning();
    await this.record(actor, 'ingest_token.created', row!.id, { name });
    return { ...this.toDto(row!), token };
  }

  async rotate(actor: ActorContext, id: string): Promise<IngestTokenWithSecret> {
    const old = await this.find(actor, id);
    const created = await this.db.transaction(async (tx) => {
      await tx
        .update(ingestTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(ingestTokens.id, id), eq(ingestTokens.workspaceId, actor.workspaceId)));
      const token = newIngestToken();
      const [row] = await tx
        .insert(ingestTokens)
        .values({
          workspaceId: actor.workspaceId,
          name: old.name,
          tokenHash: sha256(token),
          last4: token.slice(-4),
          createdBy: actor.userId,
        })
        .returning();
      return { row: row!, token };
    });
    this.cache.delete(old.tokenHash);
    await this.record(actor, 'ingest_token.rotated', id, { newId: created.row.id });
    return { ...this.toDto(created.row), token: created.token };
  }

  async revoke(actor: ActorContext, id: string): Promise<void> {
    const row = await this.find(actor, id);
    await this.db
      .update(ingestTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(ingestTokens.id, id), eq(ingestTokens.workspaceId, actor.workspaceId)));
    this.cache.delete(row.tokenHash);
    await this.record(actor, 'ingest_token.revoked', id);
  }

  async resolve(token: string | null | undefined): Promise<string | null> {
    if (!token || !token.startsWith(TOKEN_PREFIX) || token.length > 100) return null;
    const hash = sha256(token);
    const now = Date.now();
    const hit = this.cache.get(hash);
    let entry = hit && now - hit.at < CACHE_TTL_MS ? hit : null;
    if (!entry) {
      const [row] = await this.db
        .select({ id: ingestTokens.id, workspaceId: ingestTokens.workspaceId })
        .from(ingestTokens)
        .where(and(eq(ingestTokens.tokenHash, hash), isNull(ingestTokens.revokedAt)));
      entry = { workspaceId: row?.workspaceId ?? null, tokenId: row?.id ?? null, at: now };
      this.cache.set(hash, entry);
      if (this.cache.size > 50_000) this.cache.clear();
    }
    if (entry.tokenId) this.touch(entry.tokenId, now);
    return entry.workspaceId;
  }

  private touch(tokenId: string, now: number): void {
    if (now - (this.touched.get(tokenId) ?? 0) < 60_000) return;
    this.touched.set(tokenId, now);
    void this.db
      .update(ingestTokens)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(ingestTokens.id, tokenId))
      .catch(() => undefined);
  }

  private async find(actor: ActorContext, id: string): Promise<Row> {
    const [row] = await this.db
      .select()
      .from(ingestTokens)
      .where(
        and(
          eq(ingestTokens.id, id),
          eq(ingestTokens.workspaceId, actor.workspaceId),
          isNull(ingestTokens.revokedAt),
        ),
      );
    if (!row) throw notFound('Token');
    return row;
  }

  private record(
    actor: ActorContext,
    action: string,
    id: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'ingest_token',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata,
    });
  }
}
