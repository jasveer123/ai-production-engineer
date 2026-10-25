import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, lte, notInArray, sql } from 'drizzle-orm';
import { CLOSED_STATUSES } from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import {
  deployments,
  inboundEvents,
  incidentEvents,
  incidents,
  outbox,
  services,
  spans,
  workspaces,
} from '../db/schema';
import { severityFor } from '../incidents/lifecycle';
import { normalize, PermanentIngestError, type NormalizedEvent } from './normalize';
import { openIncident } from './open-incident';
import { ALERT_SOURCE_PREFIX, AlertProcessor } from '../alerts/alert-processor';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type InboundRow = typeof inboundEvents.$inferSelect;

export const MAX_ATTEMPTS = 5;
/**
 * An error can arrive before the server span that holds the request's HTTP status (the server span
 * ends last). Wait this long for it before treating the status as unknown.
 */
export const SERVER_SPAN_WAIT_MS = 20_000;
const DEFER_MS = 3_000;
const SERVER_SPAN_KIND = 2;

/** Not a failure: look at this event again shortly, without counting an attempt. */
class DeferIngest extends Error {}
const backoffMs = (attempt: number) => Math.min(60_000, 1000 * 2 ** attempt);

export interface BatchResult {
  processed: number;
  retried: number;
  dead: number;
}

/**
 * Turns buffered inbound events into deployments, incidents and incident events.
 * Safe to run concurrently and to see the same event twice (all writes are idempotent).
 */
@Injectable()
export class IngestionProcessor {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly audit: AuditService,
    private readonly alertProcessor: AlertProcessor,
  ) {}

  // Due-time checks use the database clock: host and DB container clocks drift apart.
  async processBatch(limit = 100): Promise<BatchResult> {
    const result: BatchResult = { processed: 0, retried: 0, dead: 0 };
    for (let i = 0; i < limit; i++) {
      const outcome = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(inboundEvents)
          .where(
            and(eq(inboundEvents.status, 'pending'), lte(inboundEvents.nextAttemptAt, sql`now()`)),
          )
          .orderBy(asc(inboundEvents.nextAttemptAt))
          .limit(1)
          .for('update', { skipLocked: true });
        if (!row) return 'empty' as const;

        try {
          // Savepoint: a failure rolls back the partial work but keeps the row lock.
          await tx.transaction((sp) => this.apply(sp, row));
          await tx
            .update(inboundEvents)
            .set({
              status: 'processed',
              processedAt: new Date(),
              attempts: row.attempts + 1,
              lastError: null,
            })
            .where(eq(inboundEvents.id, row.id));
          return 'processed' as const;
        } catch (err) {
          if (err instanceof DeferIngest) {
            await tx
              .update(inboundEvents)
              .set({ nextAttemptAt: sql`now() + ${DEFER_MS} * interval '1 millisecond'` })
              .where(eq(inboundEvents.id, row.id));
            return 'retried' as const;
          }
          return this.recordFailure(tx, row, err);
        }
      });
      if (outcome === 'empty') break;
      result[outcome]++;
    }
    return result;
  }

  private async recordFailure(tx: Tx, row: InboundRow, err: unknown): Promise<'retried' | 'dead'> {
    const attempts = row.attempts + 1;
    const permanent = err instanceof PermanentIngestError;
    const dead = permanent || attempts >= MAX_ATTEMPTS;
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
    await tx
      .update(inboundEvents)
      .set({
        attempts,
        lastError: message,
        status: dead ? 'dead' : 'pending',
        deadReason: dead ? (permanent ? err.reasonCode : 'max_attempts_exceeded') : null,
        nextAttemptAt: sql`now() + ${backoffMs(attempts)} * interval '1 millisecond'`,
      })
      .where(eq(inboundEvents.id, row.id));
    if (dead) {
      this.logger.warn(`Inbound event ${row.id} dead-lettered: ${message}`);
      await this.audit.record(
        {
          workspaceId: row.workspaceId,
          actorType: 'system',
          action: 'ingest.dead_lettered',
          resourceType: 'inbound_event',
          resourceId: row.id,
          outcome: 'failure',
          correlationId: `ingest-${row.id}`,
          metadata: {
            source: row.source,
            reason: permanent ? err.reasonCode : 'max_attempts_exceeded',
          },
        },
        tx,
      );
    }
    return dead ? 'dead' : 'retried';
  }

  private async apply(tx: Tx, row: InboundRow): Promise<void> {
    if (row.source.startsWith(ALERT_SOURCE_PREFIX)) return this.alertProcessor.apply(tx, row);
    const event = normalize(row.source, row.payload);
    const [service] = await tx
      .select({ id: services.id })
      .from(services)
      .where(
        and(
          eq(services.workspaceId, row.workspaceId),
          eq(services.name, event.serviceName),
          eq(services.environment, event.environment),
        ),
      );
    if (event.kind === 'deploy') {
      const recorded = await tx
        .insert(deployments)
        .values({
          workspaceId: row.workspaceId,
          integrationId: row.integrationId,
          serviceId: service?.id ?? null,
          serviceName: event.serviceName,
          environment: event.environment,
          commitSha: event.commitSha,
          version: event.version,
          externalEventId: row.externalEventId,
          deployedAt: event.occurredAt,
        })
        .onConflictDoNothing()
        .returning({ id: deployments.id });
      if (recorded.length > 0) {
        // Wakes incident workflows waiting for this service's fix deploy (Phase 7).
        await tx.insert(outbox).values({
          workspaceId: row.workspaceId,
          topic: 'deploy.recorded',
          payload: {
            deploymentId: recorded[0]!.id,
            serviceName: event.serviceName,
            environment: event.environment,
          },
        });
      }
      return;
    }
    if (await this.endedAsClientError(tx, row, event)) return;
    await this.correlateError(tx, row, event, service?.id ?? null);
  }

  /**
   * A declined card or a bad request is the app working as designed, not an incident. When the
   * error carries no HTTP status, read it from the trace's server span; if that span has not
   * arrived yet, wait a little for it (see SERVER_SPAN_WAIT_MS).
   */
  private async endedAsClientError(
    tx: Tx,
    row: InboundRow,
    event: Extract<NormalizedEvent, { kind: 'error' }>,
  ): Promise<boolean> {
    if (event.attributes.httpStatus != null || !event.traceId) return false;
    const [server] = await tx
      .select({ attributes: spans.attributes })
      .from(spans)
      .where(
        and(
          eq(spans.workspaceId, row.workspaceId),
          eq(spans.traceId, event.traceId),
          eq(spans.kind, SERVER_SPAN_KIND),
        ),
      )
      .limit(1);
    if (!server) {
      if (Date.now() - row.receivedAt.getTime() < SERVER_SPAN_WAIT_MS) throw new DeferIngest();
      return false;
    }
    const status = Number(
      server.attributes['http.response.status_code'] ?? server.attributes['http.status_code'],
    );
    return status > 0 && status < 500;
  }

  /** Attaches the error to the open incident with the same fingerprint, or opens a new one. */
  private async correlateError(
    tx: Tx,
    row: InboundRow,
    event: Extract<NormalizedEvent, { kind: 'error' }>,
    serviceId: string | null,
  ): Promise<void> {
    const [open] = await tx
      .select({ id: incidents.id })
      .from(incidents)
      .where(
        and(
          eq(incidents.workspaceId, row.workspaceId),
          eq(incidents.fingerprint, event.fingerprint),
          notInArray(incidents.status, [...CLOSED_STATUSES]),
        ),
      )
      .for('update');

    let incidentId = open?.id;
    if (!incidentId) {
      const [ws] = await tx
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, row.workspaceId));
      incidentId = await openIncident(tx, this.audit, {
        workspaceId: row.workspaceId,
        serviceId,
        serviceName: event.serviceName,
        environment: event.environment,
        source: row.source,
        title: event.title,
        fingerprint: event.fingerprint,
        severity: severityFor(ws?.settings.severityRules, event),
        occurredAt: event.occurredAt,
        summary: serviceId
          ? 'Incident detected'
          : `Incident detected. Service "${event.serviceName}" (${event.environment}) is not mapped to a repository yet.`,
        correlationId: `ingest-${row.id}`,
      });
    }

    const inserted = await tx
      .insert(incidentEvents)
      .values({
        workspaceId: row.workspaceId,
        incidentId,
        integrationId: row.integrationId,
        kind: 'error',
        source: row.source,
        externalEventId: row.externalEventId,
        occurredAt: event.occurredAt,
        summary: event.title,
        traceId: event.traceId,
        // Jaeger only holds traces it polled; ingested traces are stored here (spans table).
        sourceUrl:
          event.traceId && row.source === 'otel_jaeger'
            ? `${this.env.JAEGER_UI_URL}/trace/${event.traceId}`
            : null,
        attributes: event.attributes,
      })
      .onConflictDoNothing()
      .returning({ id: incidentEvents.id });

    if (inserted.length > 0) {
      await tx
        .update(incidents)
        .set({
          eventCount: sql`${incidents.eventCount} + 1`,
          lastSeenAt: sql`greatest(${incidents.lastSeenAt}, ${event.occurredAt.toISOString()}::timestamptz)`,
          firstSeenAt: sql`least(${incidents.firstSeenAt}, ${event.occurredAt.toISOString()}::timestamptz)`,
        })
        .where(eq(incidents.id, incidentId));
    }
  }

  /** Moves dead-lettered events back to pending (after a fix). Dedup keeps replays safe. */
  async replay(workspaceId: string, ids: string[]): Promise<number> {
    const rows = await this.db
      .update(inboundEvents)
      .set({ status: 'pending', attempts: 0, nextAttemptAt: sql`now()`, deadReason: null })
      .where(
        and(
          eq(inboundEvents.workspaceId, workspaceId),
          eq(inboundEvents.status, 'dead'),
          inArray(inboundEvents.id, ids),
        ),
      )
      .returning({ id: inboundEvents.id });
    return rows.length;
  }
}
