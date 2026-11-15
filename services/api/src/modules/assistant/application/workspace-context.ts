import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, ilike, inArray, ne, notInArray, or, sql } from 'drizzle-orm';
import { CLOSED_STATUSES } from '@ape/api-contracts';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { errorGroups, incidents, integrations, logRecords } from '../../../core/db/schema';
import { ALERT_SOURCE_PROVIDER } from '../../alerts/application/alert-sources.service';
import { OncallService } from '../../oncall/application/oncall.service';

export interface ContextItem {
  ref: string;
  kind: string;
  title: string;
  content: string;
  id: string | null;
}

const LIMIT = 10;
const LOG_LIMIT = 15;
const LOG_WINDOW_MS = 3600_000;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);
const text = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);
const config = (row: { config: unknown }) => row.config as Record<string, unknown>;

export function keywordsOf(question: string): string[] {
  const words = question.toLowerCase().match(/[a-z0-9_.-]{4,}/g) ?? [];
  const stop = new Set([
    'what',
    'which',
    'with',
    'this',
    'that',
    'have',
    'from',
    'about',
    'when',
    'were',
    'does',
    'show',
    'been',
    'there',
    'right',
    'happening',
    'wrong',
    'broken',
  ]);
  return [...new Set(words.filter((w) => !stop.has(w)))].slice(0, 3);
}

@Injectable()
export class WorkspaceContext {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly oncall: OncallService,
  ) {}

  async build(actor: ActorContext, question: string): Promise<ContextItem[]> {
    const ws = actor.workspaceId;
    const [openIncidents, errors, sourceRows, onCall] = await Promise.all([
      this.db
        .select()
        .from(incidents)
        .where(
          and(eq(incidents.workspaceId, ws), notInArray(incidents.status, [...CLOSED_STATUSES])),
        )
        .orderBy(desc(incidents.lastSeenAt))
        .limit(LIMIT),
      this.db
        .select()
        .from(errorGroups)
        .where(and(eq(errorGroups.workspaceId, ws), eq(errorGroups.status, 'unresolved')))
        .orderBy(desc(errorGroups.lastSeenAt))
        .limit(LIMIT),
      this.db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.workspaceId, ws),
            eq(integrations.provider, ALERT_SOURCE_PROVIDER),
            ne(integrations.status, 'disconnected'),
            sql`${integrations.config}->>'kind' in ('monitor', 'log_alert')`,
          ),
        ),
      this.oncall.now(actor),
    ]);
    const down = sourceRows.filter(
      (r) => config(r).kind === 'monitor' && config(r).state === 'down',
    );
    const firing = sourceRows.filter(
      (r) => config(r).kind === 'log_alert' && config(r).state === 'firing',
    );
    const monitors = sourceRows.filter((r) => config(r).kind === 'monitor');

    const items: Omit<ContextItem, 'ref'>[] = [
      {
        kind: 'summary',
        id: null,
        title: 'Workspace right now',
        content: [
          `Open incidents: ${openIncidents.length}`,
          `Unresolved error groups: ${errors.length}`,
          `Monitors: ${monitors.length}, down: ${down.length}`,
          `Log alerts firing: ${firing.length}`,
          ...onCall.map(
            (o) =>
              `On call for ${o.scheduleName}: ${o.shift ? (o.shift.person.name ?? o.shift.person.email) : 'nobody'}`,
          ),
        ].join('\n'),
      },
      ...openIncidents.map((i) => ({
        kind: 'incident',
        id: i.id,
        title: i.title,
        content: `severity ${i.severity}, status ${i.status}, service ${i.serviceName ?? 'unknown'}, ${i.eventCount} events, last seen ${i.lastSeenAt.toISOString()}${i.acknowledgedAt ? ', acknowledged' : ', not acknowledged'}`,
      })),
      ...errors.map((e) => ({
        kind: 'error',
        id: e.id,
        title: e.title,
        content: `service ${e.service} (${e.environment}), ${e.count} events, last seen ${e.lastSeenAt.toISOString()}\n${e.stack.slice(0, 4).join('\n')}`,
      })),
      ...down.map((m) => ({
        kind: 'monitor',
        id: m.id,
        title: `${m.name} is down`,
        content: `since ${String(config(m).stateSince)}, last error: ${text(config(m).lastError, 'none')}`,
      })),
      ...firing.map((a) => ({
        kind: 'log_alert',
        id: a.id,
        title: `${a.name} is firing`,
        content: `${String(config(a).lastCount)} matching logs in ${String(config(a).windowMinutes)} minutes`,
      })),
      ...(await this.logs(ws, question)),
    ];
    return items.map((item, i) => ({ ...item, ref: `C${i + 1}` }));
  }

  private async logs(ws: string, question: string): Promise<Omit<ContextItem, 'ref'>[]> {
    const since = new Date(Date.now() - LOG_WINDOW_MS);
    const words = keywordsOf(question);
    const match = words.length
      ? or(
          ...words.map((w) => ilike(logRecords.message, `%${escapeLike(w)}%`)),
          ...words.map((w) => eq(logRecords.service, w)),
        )
      : undefined;
    const rows = await this.db
      .select()
      .from(logRecords)
      .where(
        and(
          eq(logRecords.workspaceId, ws),
          gte(logRecords.ts, since),
          match ?? inArray(logRecords.level, ['error', 'fatal', 'warn']),
        ),
      )
      .orderBy(desc(logRecords.ts))
      .limit(LOG_LIMIT);
    return rows.map((l) => ({
      kind: 'log',
      id: null,
      title: `${l.level} in ${l.service}`,
      content: `${l.ts.toISOString()} ${l.service}/${l.environment} ${l.level}: ${l.message.slice(0, 500)}`,
    }));
  }
}
