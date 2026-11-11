import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  integrations,
  statusPageMonitors,
  statusPages,
  statusUpdates,
} from '../../../core/db/schema';
import { SubscribersService } from './subscribers.service';

@Injectable()
export class StatusAutomationService {
  private readonly logger = new Logger(StatusAutomationService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly subscribers: SubscribersService,
  ) {}

  async tick(): Promise<number> {
    const links = await this.db.select().from(statusPageMonitors);
    if (links.length === 0) return 0;
    const monitors = await this.db
      .select()
      .from(integrations)
      .where(
        inArray(
          integrations.id,
          links.map((l) => l.monitorId),
        ),
      );
    let posted = 0;
    for (const link of links) {
      const monitor = monitors.find((m) => m.id === link.monitorId);
      const state = (monitor?.config as { state?: string } | undefined)?.state;
      if (!monitor || !state || state === 'pending' || state === link.lastState) continue;
      await this.db
        .update(statusPageMonitors)
        .set({ lastState: state })
        .where(eq(statusPageMonitors.monitorId, link.monitorId));
      if (link.lastState === null && state === 'up') continue;
      const [page] = await this.db
        .select()
        .from(statusPages)
        .where(eq(statusPages.id, link.pageId));
      if (!page) continue;
      const down = state === 'down';
      const update = {
        title: down ? `${monitor.name} is down` : `${monitor.name} is back up`,
        body: down
          ? 'Our monitoring detected a problem. We are looking into it.'
          : 'The problem is fixed and the service is working again.',
        state: down ? 'investigating' : 'resolved',
      };
      await this.db.insert(statusUpdates).values({
        workspaceId: page.workspaceId,
        pageId: page.id,
        auto: true,
        ...update,
      });
      await this.subscribers
        .notify(page.id, update)
        .catch((err: unknown) => this.logger.error(err));
      posted += 1;
    }
    return posted;
  }
}
