import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import type { Database } from '../../../core/db/client';
import { DB } from '../../../core/db/database.module';
import { integrations } from '../../../core/db/schema';
import { GitHubService } from '../../github/github.service';
import { JaegerPoller } from '../../../ingest/ingestion/application/jaeger.poller';

type Row = typeof integrations.$inferSelect;

@Injectable()
export class IntegrationHealth {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly poller: JaegerPoller,
    private readonly github: GitHubService,
  ) {}

  check(row: Row): Promise<Row> {
    return row.provider === 'github' ? this.github.check(row) : this.checkJaeger(row);
  }

  private async checkJaeger(row: Row): Promise<Row> {
    let patch: Partial<Row>;
    try {
      await this.poller.client.services();
      patch = {
        status: 'connected',
        lastError: null,
        externalAccountId: this.env.JAEGER_QUERY_URL,
      };
    } catch (err) {
      patch = {
        status: 'error',
        lastError: `Could not reach Jaeger at ${this.env.JAEGER_QUERY_URL} (${(err as Error).message}). Is the local stack running (make up)?`,
      };
    }
    const [updated] = await this.db
      .update(integrations)
      .set(patch)
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)))
      .returning();
    return updated!;
  }
}
