import { createHash } from 'node:crypto';
import { Controller, HttpCode, HttpStatus, Inject, Param, Post, Req } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { Public } from '../auth/public.decorator';
import { ApiException, notFound } from '../common/errors';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { inboundEvents, integrations } from '../db/schema';
import { SecretStore } from '../secrets/secret-store.service';
import { deployPayloadSchema } from './normalize';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifySignature } from './webhook-signature';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Receives signed deploy markers. Authentication is the per-integration HMAC signature, not a
 * session. The event is only buffered here; the processor does the rest asynchronously.
 */
@Controller('ingest')
export class DeployWebhookController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly secrets: SecretStore,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post('deploys/:integrationId')
  @HttpCode(HttpStatus.ACCEPTED)
  async receive(
    @Param('integrationId') integrationId: string,
    @Req() req: Request,
  ): Promise<{ accepted: true; duplicate: boolean }> {
    const [integration] = UUID.test(integrationId)
      ? await this.db
          .select()
          .from(integrations)
          .where(
            and(
              eq(integrations.id, integrationId),
              eq(integrations.provider, 'deploy_webhook'),
              ne(integrations.status, 'disconnected'),
            ),
          )
      : [];
    if (!integration?.secretReference) throw notFound('Webhook');

    const secret = await this.secrets.get(integration.workspaceId, integration.secretReference);
    const check = verifySignature(
      secret ?? '',
      req.header(TIMESTAMP_HEADER),
      req.header(SIGNATURE_HEADER),
      req.rawBody ?? Buffer.alloc(0),
    );
    if (!secret || !check.ok) {
      const reason = check.ok ? 'missing_secret' : check.reason;
      await this.audit.record({
        workspaceId: integration.workspaceId,
        actorType: 'system',
        action: 'webhook.rejected',
        resourceType: 'integration',
        resourceId: integration.id,
        outcome: 'denied',
        correlationId: req.correlationId,
        metadata: { reason, ip: req.ip },
      });
      await this.db
        .update(integrations)
        .set({ lastError: `Rejected a webhook (${reason}) at ${new Date().toISOString()}` })
        .where(eq(integrations.id, integration.id));
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'invalid_signature',
        'Webhook signature check failed',
      );
    }

    const body = deployPayloadSchema.safeParse(req.body);
    if (!body.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        body.error.issues[0]?.message ?? 'Invalid body',
      );
    }

    // Identical bodies (retries, replays inside the timestamp window) map to one event.
    const externalEventId = createHash('sha256').update(req.rawBody!).digest('hex');
    const inserted = await this.db
      .insert(inboundEvents)
      .values({
        workspaceId: integration.workspaceId,
        integrationId: integration.id,
        source: 'deploy_webhook',
        externalEventId,
        payload: body.data,
      })
      .onConflictDoNothing()
      .returning({ id: inboundEvents.id });

    // A correctly signed event is what validates the integration (FR-02).
    await this.db
      .update(integrations)
      .set({ status: 'connected', lastSyncAt: new Date(), lastError: null })
      .where(eq(integrations.id, integration.id));

    return { accepted: true, duplicate: inserted.length === 0 };
  }
}
