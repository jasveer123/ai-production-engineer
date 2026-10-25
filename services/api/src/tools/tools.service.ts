import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, ne, sql } from 'drizzle-orm';
import {
  connectReaderSchema,
  TOOL_IDS,
  type ReaderLogLine,
  type ToolAlertsEnabled,
  type ToolId,
  type ToolView,
} from '@ape/api-contracts';
import {
  AlertSourcesService,
  ALERT_SOURCE_PROVIDER,
  type SourceConfig,
} from '../alerts/alert-sources.service';
import { AuditService } from '../audit/audit.service';
import { ApiException, notFound } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { integrations } from '../db/schema';
import { SecretStore } from '../secrets/secret-store.service';
import {
  readLogs,
  ReaderError,
  splitReaderInput,
  type FetchFn,
  type ReaderConfig,
  type ReaderQuery,
} from './readers';
import { TOOL_CATALOG } from './tool-catalog';

export const LOG_READER_PROVIDER = 'log_reader';
type Row = typeof integrations.$inferSelect;

interface ReaderRowConfig {
  tool: ToolId;
  settings: Record<string, string>;
  lastUsedAt?: string | null;
}

export const isToolId = (v: string): v is ToolId => (TOOL_IDS as readonly string[]).includes(v);

function readerView(reader: Row | undefined): ToolView['reader'] {
  const rc = reader?.config as unknown as ReaderRowConfig | undefined;
  return {
    status: !reader ? 'not_connected' : reader.status === 'connected' ? 'connected' : 'error',
    settings: rc?.settings ?? {},
    lastUsedAt: rc?.lastUsedAt ?? null,
    lastError: reader?.lastError ?? null,
  };
}

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  /** Swappable in tests. */
  fetchFn: FetchFn = (...args) => fetch(...args);
  /**
   * Per-tool hooks that refresh short-lived credentials before a query (Sentry app tokens expire
   * every 8 hours). Registered by the setup module. Returns new secrets to store, or null.
   */
  readonly refreshers = new Map<
    ToolId,
    (
      settings: Record<string, string>,
      secrets: Record<string, string>,
    ) => Promise<Record<string, string> | null>
  >();

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly secrets: SecretStore,
    private readonly audit: AuditService,
    private readonly alertSources: AlertSourcesService,
  ) {}

  private async rows(workspaceId: string): Promise<{ sources: Row[]; readers: Row[] }> {
    const rows = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, workspaceId),
          ne(integrations.status, 'disconnected'),
          sql`${integrations.provider} in (${ALERT_SOURCE_PROVIDER}, ${LOG_READER_PROVIDER})`,
        ),
      );
    return {
      sources: rows.filter((r) => r.provider === ALERT_SOURCE_PROVIDER),
      readers: rows.filter((r) => r.provider === LOG_READER_PROVIDER),
    };
  }

  private view(id: ToolId, sources: Row[], readers: Row[]): ToolView {
    const meta = TOOL_CATALOG[id];
    const source = sources
      .filter((s) => (s.config as unknown as SourceConfig).kind === meta.alertKind)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const reader = readers.find((r) => (r.config as unknown as ReaderRowConfig).tool === id);
    return {
      id,
      name: meta.name,
      description: meta.description,
      readsWhat: meta.readsWhat,
      alerts: this.alertsView(source),
      reader: readerView(reader),
    };
  }

  private alertsView(source: Row | undefined): ToolView['alerts'] {
    const dto = source ? this.alertSources.toDto(source) : null;
    return {
      enabled: Boolean(source),
      sourceId: source?.id ?? null,
      url: dto?.url ?? null,
      lastReceivedAt: dto?.lastReceivedAt ?? null,
      lastError: source?.lastError ?? null,
    };
  }

  async list(actor: ActorContext): Promise<ToolView[]> {
    const { sources, readers } = await this.rows(actor.workspaceId);
    return TOOL_IDS.map((id) => this.view(id, sources, readers));
  }

  async get(actor: ActorContext, id: ToolId): Promise<ToolView> {
    const { sources, readers } = await this.rows(actor.workspaceId);
    return this.view(id, sources, readers);
  }

  /** Way 6. On: creates an alert source (token shown once). Off: disconnects it. */
  async setAlerts(actor: ActorContext, id: ToolId, enabled: boolean): Promise<ToolAlertsEnabled> {
    const current = await this.get(actor, id);
    const meta = TOOL_CATALOG[id];
    if (enabled && !current.alerts.enabled) {
      const created = await this.alertSources.create(actor, {
        kind: meta.alertKind,
        name: meta.name,
      } as never);
      const tool = await this.get(actor, id);
      return {
        tool,
        token: created.token,
        url: created.url,
        setup: meta.alertSetup
          .replaceAll('{url}', created.url)
          .replaceAll('{token}', created.token),
      };
    }
    if (!enabled && current.alerts.sourceId)
      await this.alertSources.remove(actor, current.alerts.sourceId);
    const tool = await this.get(actor, id);
    return {
      tool,
      token: null,
      url: tool.alerts.url ?? '',
      setup: tool.alerts.url
        ? meta.alertSetup.replaceAll('{url}', tool.alerts.url).replaceAll('{token}', '<your token>')
        : '',
    };
  }

  /**
   * For automatic setup: the URL and a usable token of this tool's alert source. Creates the
   * source, or rotates the token of an existing one (tokens are only readable when issued).
   */
  async alertTarget(actor: ActorContext, id: ToolId): Promise<{ url: string; token: string }> {
    const current = await this.get(actor, id);
    if (current.alerts.sourceId) {
      const rotated = await this.alertSources.rotate(actor, current.alerts.sourceId);
      return { url: rotated.url, token: rotated.token };
    }
    const meta = TOOL_CATALOG[id];
    const created = await this.alertSources.create(actor, {
      kind: meta.alertKind,
      name: meta.name,
    } as never);
    return { url: created.url, token: created.token };
  }

  /** Way 7. Saves read-only credentials (encrypted), then tests them with a small query. */
  async connectReader(actor: ActorContext, id: ToolId, body: unknown): Promise<ToolView> {
    const parsed = connectReaderSchema.safeParse({ ...(body as object), tool: id });
    if (!parsed.success)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        parsed.error.issues,
      );
    const cfg = splitReaderInput(parsed.data);
    const existing = await this.readerRow(actor.workspaceId, id);

    await this.db.transaction(async (tx) => {
      const secretReference = await this.secrets.put(
        actor.workspaceId,
        JSON.stringify(cfg.secrets),
        tx,
      );
      if (existing?.secretReference)
        await this.secrets.delete(actor.workspaceId, existing.secretReference, tx);
      const config = {
        tool: id,
        settings: cfg.settings,
        lastUsedAt: null,
      } satisfies ReaderRowConfig;
      if (existing) {
        await tx
          .update(integrations)
          .set({
            config: config,
            secretReference,
            status: 'pending',
            lastError: null,
          })
          .where(
            and(
              eq(integrations.id, existing.id),
              eq(integrations.workspaceId, existing.workspaceId),
            ),
          );
      } else {
        await tx.insert(integrations).values({
          workspaceId: actor.workspaceId,
          provider: LOG_READER_PROVIDER,
          name: `${TOOL_CATALOG[id].name} (read-only)`,
          config: config,
          secretReference,
        });
      }
    });
    await this.record(actor, 'log_reader.connected', id);
    return this.testReader(actor, id);
  }

  /** Runs a 15-minute, 5-line query. Only success marks the reader connected (FR-02). */
  async testReader(actor: ActorContext, id: ToolId): Promise<ToolView> {
    const row = await this.readerRow(actor.workspaceId, id);
    if (!row) throw notFound('Connection');
    const to = new Date();
    let patch: Partial<Row>;
    try {
      await this.query(row, {
        service: null,
        environment: null,
        from: new Date(to.getTime() - 15 * 60_000),
        to,
        limit: 5,
      });
      patch = { status: 'connected', lastError: null, lastSyncAt: new Date() };
    } catch (err) {
      patch = {
        status: 'error',
        lastError:
          err instanceof ReaderError ? err.message : `Test failed: ${(err as Error).message}`,
      };
    }
    await this.db
      .update(integrations)
      .set(patch)
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)));
    await this.record(actor, 'log_reader.tested', id, { status: patch.status });
    return this.get(actor, id);
  }

  async disconnectReader(actor: ActorContext, id: ToolId): Promise<ToolView> {
    const row = await this.readerRow(actor.workspaceId, id);
    if (row) {
      await this.db.transaction(async (tx) => {
        if (row.secretReference)
          await this.secrets.delete(actor.workspaceId, row.secretReference, tx);
        await tx
          .update(integrations)
          .set({ status: 'disconnected', secretReference: null })
          .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)));
      });
      await this.record(actor, 'log_reader.disconnected', id);
    }
    return this.get(actor, id);
  }

  private async readerRow(workspaceId: string, id: ToolId): Promise<Row | undefined> {
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, workspaceId),
          eq(integrations.provider, LOG_READER_PROVIDER),
          ne(integrations.status, 'disconnected'),
          sql`${integrations.config}->>'tool' = ${id}`,
        ),
      );
    return row;
  }

  private async query(row: Row, q: ReaderQuery): Promise<ReaderLogLine[]> {
    const rc = row.config as unknown as ReaderRowConfig;
    const raw = row.secretReference
      ? await this.secrets.get(row.workspaceId, row.secretReference)
      : null;
    if (!raw) throw new ReaderError('The stored credentials are missing. Connect again.');
    const cfg: ReaderConfig = {
      settings: rc.settings,
      secrets: JSON.parse(raw) as Record<string, string>,
    };
    return readLogs(rc.tool, cfg, q, this.fetchFn);
  }

  /**
   * For investigations: every connected reader, queried in parallel. Failures are returned as
   * gaps so the report can say what it could not see (never invented).
   */
  async readForIncident(
    workspaceId: string,
    q: ReaderQuery,
  ): Promise<{ tool: ToolId; name: string; lines: ReaderLogLine[]; error: string | null }[]> {
    const rows = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, workspaceId),
          eq(integrations.provider, LOG_READER_PROVIDER),
          eq(integrations.status, 'connected'),
        ),
      );
    return Promise.all(
      rows.map(async (row) => {
        const tool = (row.config as unknown as ReaderRowConfig).tool;
        try {
          const lines = await this.query(row, q);
          await this.db
            .update(integrations)
            .set({
              config: sql`${integrations.config} || jsonb_build_object('lastUsedAt', ${new Date().toISOString()}::text)`,
            })
            .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)));
          return { tool, name: TOOL_CATALOG[tool].name, lines, error: null };
        } catch (err) {
          this.logger.warn(`Reader ${tool} failed during investigation: ${(err as Error).message}`);
          return { tool, name: TOOL_CATALOG[tool].name, lines: [], error: (err as Error).message };
        }
      }),
    );
  }

  private record(
    actor: ActorContext,
    action: string,
    tool: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'tool',
      resourceId: tool,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata,
    });
  }
}
