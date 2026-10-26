import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, lt, lte, ne } from 'drizzle-orm';
import { TRAFFIC_COUNT_CAP } from '@ape/api-contracts';
import type { Database } from '../db/client';
import { DB } from '../db/database.module';
import {
  deployments,
  incidentEvents,
  incidents,
  integrations,
  services,
  type VerificationBaseline,
  type VerificationObserved,
} from '../db/schema';
import { JaegerPoller } from '../ingestion/jaeger.poller';
import { expectedErrors } from './recovery';

type IncidentRow = typeof incidents.$inferSelect;

const BASELINE_LOOKBACK_MS = 24 * 60 * 60_000;

/** Reads what verification compares: error counts before and after a fix, and traffic. */
@Injectable()
export class VerificationMetrics {
  private readonly logger = new Logger(VerificationMetrics.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly jaeger: JaegerPoller,
  ) {}

  async incident(id: string, workspaceId: string): Promise<IncidentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, id), eq(incidents.workspaceId, workspaceId)));
    return row;
  }

  async repositoryOf(incident: IncidentRow): Promise<string | null> {
    if (!incident.serviceId) return null;
    const [svc] = await this.db
      .select({ repo: services.repositoryFullName })
      .from(services)
      .where(eq(services.id, incident.serviceId));
    return svc?.repo ?? null;
  }

  private async errorCount(incidentId: string, from: Date, to: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(incidentEvents)
      .where(
        and(
          eq(incidentEvents.incidentId, incidentId),
          eq(incidentEvents.kind, 'error'),
          gte(incidentEvents.occurredAt, from),
          lt(incidentEvents.occurredAt, to),
        ),
      );
    return Number(row?.n ?? 0);
  }

  /** Error rate of the incident's fingerprint before the fix (up to 24 h back). */
  async baseline(incident: IncidentRow, deployedAt: Date): Promise<VerificationBaseline> {
    const from = new Date(
      Math.max(incident.firstSeenAt.getTime(), deployedAt.getTime() - BASELINE_LOOKBACK_MS),
    );
    const durationMs = Math.max(60_000, deployedAt.getTime() - from.getTime());
    const errors = await this.errorCount(incident.id, from, deployedAt);
    return {
      errors,
      durationMs,
      errorsPerHour: Math.round((errors / durationMs) * 3_600_000 * 100) / 100,
    };
  }

  async observe(
    incident: IncidentRow,
    start: Date,
    end: Date,
    baseline: VerificationBaseline,
    withTraffic: boolean,
  ): Promise<VerificationObserved> {
    const durationMs = Math.max(0, end.getTime() - start.getTime());
    const errors = await this.errorCount(incident.id, start, end);
    const operation = await this.failingOperation(incident.id);
    const requests =
      withTraffic && operation ? await this.traffic(incident, operation, start, end) : null;
    return {
      errors,
      durationMs,
      requests,
      operation,
      expectedErrors: expectedErrors(baseline.errorsPerHour, durationMs),
    };
  }

  /** The server operation the errors came from, e.g. "POST /checkout". */
  private async failingOperation(incidentId: string): Promise<string | null> {
    const [e] = await this.db
      .select({ attributes: incidentEvents.attributes })
      .from(incidentEvents)
      .where(and(eq(incidentEvents.incidentId, incidentId), eq(incidentEvents.kind, 'error')))
      .orderBy(desc(incidentEvents.occurredAt))
      .limit(1);
    const op = e?.attributes.operation;
    return typeof op === 'string' && op ? op : null;
  }

  /** Request count from Jaeger, or null when no Jaeger integration is connected or it fails. */
  private async traffic(
    incident: IncidentRow,
    operation: string,
    start: Date,
    end: Date,
  ): Promise<number | null> {
    const [jaeger] = await this.db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, incident.workspaceId),
          eq(integrations.provider, 'otel_jaeger'),
          inArray(integrations.status, ['connected', 'error']),
        ),
      )
      .limit(1);
    if (!jaeger || !incident.serviceName) return null;
    try {
      return await this.jaeger.client.traceCount(
        incident.serviceName,
        operation,
        start.getTime() * 1000,
        end.getTime() * 1000,
        TRAFFIC_COUNT_CAP,
      );
    } catch (err) {
      this.logger.warn(`Traffic count for ${operation} failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Names the deploy before the fix as a rollback candidate. A human decides (ADR-008). */
  async rollbackHint(deploymentId: string | null): Promise<string> {
    if (!deploymentId) return '';
    const [fix] = await this.db.select().from(deployments).where(eq(deployments.id, deploymentId));
    if (!fix) return '';
    const [prev] = await this.db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.workspaceId, fix.workspaceId),
          eq(deployments.serviceName, fix.serviceName),
          eq(deployments.environment, fix.environment),
          lte(deployments.deployedAt, fix.deployedAt),
          ne(deployments.id, fix.id),
        ),
      )
      .orderBy(desc(deployments.deployedAt))
      .limit(1);
    return prev
      ? `. The previous deploy was ${prev.version ?? prev.commitSha.slice(0, 7)} (${prev.commitSha.slice(0, 7)}); consider rolling back or investigating again.`
      : '. Consider investigating again.';
  }
}
