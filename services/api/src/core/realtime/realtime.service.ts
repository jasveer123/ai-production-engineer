import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Client } from 'pg';
import { filter, map, Observable, Subject } from 'rxjs';
import type { LiveChange } from '@ape/api-contracts';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { sessions, workspaceMembers, workspaces } from '../db/schema';

export const CHANNEL = 'ape_changes';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RawChange {
  w: string;
  t: string;
  i: string | null;
}

export function parseChange(payload: string | undefined): RawChange | null {
  try {
    const p = JSON.parse(payload ?? '') as Partial<RawChange>;
    if (typeof p.w !== 'string' || !UUID.test(p.w) || typeof p.t !== 'string') return null;
    return { w: p.w, t: p.t, i: typeof p.i === 'string' && UUID.test(p.i) ? p.i : null };
  } catch {
    return null;
  }
}

export function dedupeChanges(batch: LiveChange[]): LiveChange[] {
  const seen = new Map<string, LiveChange>();
  for (const c of batch) seen.set(`${c.table}:${c.incidentId ?? ''}`, c);
  return [...seen.values()];
}

@Injectable()
export class RealtimeService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly changes$ = new Subject<RawChange>();
  private client?: Client;
  private stopped = false;
  private retry?: NodeJS.Timeout;
  private ready?: Promise<void>;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  onApplicationBootstrap() {
    if (this.env.REALTIME_ENABLED) this.ready = this.connect(0);
  }

  async onApplicationShutdown() {
    this.stopped = true;
    clearTimeout(this.retry);
    this.changes$.complete();
    await this.client?.end().catch(() => undefined);
  }

  whenReady(): Promise<void> {
    return this.ready ?? Promise.resolve();
  }

  private async connect(attempt: number): Promise<void> {
    if (this.stopped) return;
    const client = new Client({ connectionString: this.env.DATABASE_URL });
    const reconnect = () => {
      if (this.stopped || this.client !== client) return;
      this.client = undefined;
      const delay = Math.min(30_000, 1000 * 2 ** attempt);
      this.logger.warn(`LISTEN connection lost; reconnecting in ${delay} ms`);
      this.retry = setTimeout(() => void (this.ready = this.connect(attempt + 1)), delay);
    };
    client.on('notification', (msg) => {
      if (msg.channel !== CHANNEL) return;
      const change = parseChange(msg.payload);
      if (change) this.changes$.next(change);
    });
    client.on('error', (err) => this.logger.warn(`LISTEN connection error: ${err.message}`));
    client.on('end', reconnect);
    this.client = client;
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      attempt = 0;
    } catch (err) {
      this.logger.warn(`Could not LISTEN: ${(err as Error).message}`);
      await client.end().catch(() => undefined);
      reconnect();
    }
  }

  changes(workspaceId: string): Observable<LiveChange> {
    return this.changes$.pipe(
      filter((c) => c.w === workspaceId),
      map((c) => ({ table: c.t, incidentId: c.i })),
    );
  }

  async stillAllowed(workspaceId: string, userId: string, sessionId: string): Promise<boolean> {
    const [member] = await this.db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaces.status, 'active'),
        ),
      );
    if (!member) return false;
    const [session] = await this.db
      .select({ revokedAt: sessions.revokedAt, expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    return !!session && !session.revokedAt && session.expiresAt > new Date();
  }
}
