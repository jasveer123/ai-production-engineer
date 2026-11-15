import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import {
  API_TOKEN_PREFIX,
  type ApiTokenArea,
  type ApiTokenScope,
  type ApiTokenView,
  type ApiTokenWithSecret,
  type CreateApiTokenInput,
} from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import type { TokenGrant } from '../domain/token-scope';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { apiTokens, workspaceMembers } from '../../../core/db/schema';

type Row = typeof apiTokens.$inferSelect;

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');
const TOUCH_AFTER_MS = 60_000;
const MAX_TOKENS = 25;

const toView = (r: Row): ApiTokenView => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  workspaceId: r.workspaceId,
  scopes: r.scopes as ApiTokenScope[],
  areas: r.areas as ApiTokenArea[],
  expiresAt: r.expiresAt?.toISOString() ?? null,
  lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class ApiTokensService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(userId: string): Promise<ApiTokenView[]> {
    const rows = await this.db
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
      .orderBy(desc(apiTokens.createdAt))
      .limit(MAX_TOKENS);
    return rows.map(toView);
  }

  async create(userId: string, input: CreateApiTokenInput): Promise<ApiTokenWithSecret> {
    const [member] = await this.db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, input.workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      );
    if (!member) throw notFound('Workspace');
    const token = `${API_TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;
    const days = input.expiresInDays === undefined ? 90 : input.expiresInDays;
    const [row] = await this.db
      .insert(apiTokens)
      .values({
        userId,
        workspaceId: input.workspaceId,
        scopes: [...new Set(input.scopes ?? ['read'])],
        areas: [...new Set(input.areas ?? [])],
        name: input.name,
        prefix: token.slice(0, API_TOKEN_PREFIX.length + 6),
        tokenHash: hashOf(token),
        expiresAt: days ? new Date(Date.now() + days * 24 * 3600 * 1000) : null,
      })
      .returning();
    return { ...toView(row!), token };
  }

  async revoke(userId: string, id: string): Promise<void> {
    const rows = await this.db
      .update(apiTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
      .returning({ id: apiTokens.id });
    if (rows.length === 0) throw notFound('API token');
  }

  async resolve(token: string): Promise<{ userId: string; grant: TokenGrant } | null> {
    if (!token.startsWith(API_TOKEN_PREFIX)) return null;
    const [row] = await this.db
      .select()
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.tokenHash, hashOf(token)),
          isNull(apiTokens.revokedAt),
          or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, new Date())),
        ),
      );
    if (!row) return null;
    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > TOUCH_AFTER_MS)
      await this.db
        .update(apiTokens)
        .set({ lastUsedAt: sql`now()` })
        .where(eq(apiTokens.id, row.id));
    return {
      userId: row.userId,
      grant: { id: row.id, workspaceId: row.workspaceId, scopes: row.scopes, areas: row.areas },
    };
  }
}
