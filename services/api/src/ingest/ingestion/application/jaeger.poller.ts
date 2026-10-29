import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { inboundEvents, integrations, services } from '../../../core/db/schema';
import { extractError, JaegerClient } from '../infrastructure/jaeger';

const INITIAL_LOOKBACK_MS = 10 * 60_000;
const OVERLAP_MS = 30_000;

@Injectable()
export class JaegerPoller {
  private readonly logger = new Logger(JaegerPoller.name);
  readonly client: JaegerClient;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) env: ApiEnv,
  ) {
    this.client = new JaegerClient(env.JAEGER_QUERY_URL);
  }

  async pollAll(now = Date.now()): Promise<number> {
    const active = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, 'otel_jaeger'),
          inArray(integrations.status, ['connected', 'error']),
        ),
      );
    let total = 0;
    for (const integration of active) total += await this.pollOne(integration, now);
    return total;
  }

  private async pollOne(
    integration: typeof integrations.$inferSelect,
    now: number,
  ): Promise<number> {
    const cursor = Number(integration.config.cursorMs ?? now - INITIAL_LOOKBACK_MS);
    const startMs = Math.max(cursor - OVERLAP_MS, now - 24 * 60 * 60_000);
    const names = await this.db
      .selectDistinct({ name: services.name })
      .from(services)
      .where(eq(services.workspaceId, integration.workspaceId));

    try {
      let inserted = 0;
      for (const { name } of names) {
        const traces = await this.client.errorTraces(name, startMs * 1000, now * 1000);
        const rows = traces
          .map((t) => extractError(t, name))
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .map((e) => ({
            workspaceId: integration.workspaceId,
            integrationId: integration.id,
            source: 'otel_jaeger',
            externalEventId: e.traceId,
            payload: e,
          }));
        if (rows.length > 0) {
          const res = await this.db
            .insert(inboundEvents)
            .values(rows)
            .onConflictDoNothing()
            .returning({ id: inboundEvents.id });
          inserted += res.length;
        }
      }
      await this.db
        .update(integrations)
        .set({
          status: 'connected',
          lastError: null,
          lastSyncAt: new Date(now),
          config: { ...integration.config, cursorMs: now },
        })
        .where(eq(integrations.id, integration.id));
      return inserted;
    } catch (err) {
      const message = `Jaeger poll failed: ${(err as Error).message}`;
      this.logger.warn(`${integration.id}: ${message}`);
      await this.db
        .update(integrations)
        .set({ status: 'error', lastError: message })
        .where(eq(integrations.id, integration.id));
      return 0;
    }
  }
}
