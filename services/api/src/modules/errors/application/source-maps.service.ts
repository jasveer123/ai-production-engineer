import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { SourceMapInput, SourceMapView } from '@ape/api-contracts';
import { ApiException, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { sourceMaps } from '../../../core/db/schema';
import { parseSourceMap, symbolicateFrame } from '../domain/sourcemap';

@Injectable()
export class SourceMapsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(actor: ActorContext): Promise<SourceMapView[]> {
    const rows = await this.db
      .select({
        id: sourceMaps.id,
        release: sourceMaps.release,
        file: sourceMaps.file,
        size: sql<number>`length(${sourceMaps.content})::int`,
        createdAt: sourceMaps.createdAt,
      })
      .from(sourceMaps)
      .where(eq(sourceMaps.workspaceId, actor.workspaceId))
      .orderBy(desc(sourceMaps.createdAt))
      .limit(200);
    return rows.map((r) => ({
      id: r.id,
      release: r.release,
      file: r.file,
      sizeBytes: r.size,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async upload(actor: ActorContext, input: SourceMapInput): Promise<SourceMapView> {
    try {
      parseSourceMap(input.map);
    } catch {
      throw new ApiException(400, 'invalid_source_map', 'That is not a valid source map file');
    }
    const file = input.file.split('/').pop()!.split('?')[0]!;
    const [row] = await this.db
      .insert(sourceMaps)
      .values({ workspaceId: actor.workspaceId, release: input.release, file, content: input.map })
      .onConflictDoUpdate({
        target: [sourceMaps.workspaceId, sourceMaps.release, sourceMaps.file],
        set: { content: input.map, createdAt: new Date() },
      })
      .returning();
    return {
      id: row!.id,
      release: row!.release,
      file: row!.file,
      sizeBytes: Buffer.byteLength(input.map),
      createdAt: row!.createdAt.toISOString(),
    };
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const removed = await this.db
      .delete(sourceMaps)
      .where(and(eq(sourceMaps.id, id), eq(sourceMaps.workspaceId, actor.workspaceId)))
      .returning({ id: sourceMaps.id });
    if (removed.length === 0) throw notFound('Source map');
  }

  async symbolicate(
    workspaceId: string,
    release: string | null,
    stack: string[],
  ): Promise<string[] | null> {
    if (!release || stack.length === 0) return null;
    const rows = await this.db
      .select({ file: sourceMaps.file, content: sourceMaps.content })
      .from(sourceMaps)
      .where(and(eq(sourceMaps.workspaceId, workspaceId), eq(sourceMaps.release, release)));
    if (rows.length === 0) return null;
    const parsed = new Map<string, ReturnType<typeof parseSourceMap>>();
    for (const row of rows) {
      try {
        parsed.set(row.file, parseSourceMap(row.content));
      } catch {
        continue;
      }
    }
    let changed = false;
    const out = stack.map((frame) => {
      const mapped = symbolicateFrame(frame, (file) => parsed.get(file) ?? null);
      if (mapped) changed = true;
      return mapped ?? frame;
    });
    return changed ? out : null;
  }
}
