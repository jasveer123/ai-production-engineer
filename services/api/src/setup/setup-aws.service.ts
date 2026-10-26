import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gt, ne, sql } from 'drizzle-orm';
import type { AwsSetupStart } from '@ape/api-contracts';
import { newLinkToken, sha256 } from '../auth/password';
import { ApiException, notFound } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { ENV, type ApiEnv } from '../config/config.module';
import type { Database } from '../db/client';
import { DB } from '../db/database.module';
import { integrations } from '../db/schema';
import { ToolsService } from '../tools/tools.service';
import { cloudFormationCommand } from './aws';
import { apiUrl } from './setup-config';
import { SetupSupport } from './setup-support.service';

const AWS_SETUP_TTL_MS = 2 * 60 * 60 * 1000;

/** AWS CloudWatch setup: one CloudFormation command that calls back with a read-only key. */
@Injectable()
export class AwsSetupService {
  private readonly logger = new Logger(AwsSetupService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly support: SetupSupport,
    private readonly tools: ToolsService,
  ) {}

  async awsStart(actor: ActorContext): Promise<AwsSetupStart> {
    const alerts = await this.tools.alertTarget(actor, 'cloudwatch');
    const token = newLinkToken();
    const expiresAt = new Date(Date.now() + AWS_SETUP_TTL_MS);
    await this.support.saveRow(actor, {
      provider: 'aws_setup',
      name: 'AWS setup',
      config: {
        tokenHash: sha256(token),
        expiresAt: expiresAt.toISOString(),
        actorId: actor.userId,
      },
    });
    const base = apiUrl(this.env);
    const templateUrl = `${base}/setup/aws/template.yaml`;
    return {
      templateUrl,
      expiresAt: expiresAt.toISOString(),
      command: cloudFormationCommand({
        templateUrl,
        callbackUrl: `${base}/setup/aws/callback/${token}`,
        alertUrl: `${alerts.url}?token=${alerts.token}`,
      }),
    };
  }

  /** Called once by the stack's Lambda with the read-only key it created. */
  async awsCallback(
    token: string,
    body: { accessKeyId?: string; secretAccessKey?: string; region?: string; logGroups?: string[] },
    correlationId: string,
  ): Promise<void> {
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, 'aws_setup'),
          ne(integrations.status, 'disconnected'),
          sql`${integrations.config}->>'tokenHash' = ${sha256(token)}`,
          gt(sql`(${integrations.config}->>'expiresAt')::timestamptz`, sql`now()`),
        ),
      );
    if (!row) throw notFound('Setup');
    // Single use: burn it before doing anything else.
    await this.db
      .update(integrations)
      .set({ status: 'disconnected' })
      .where(eq(integrations.id, row.id));
    const cfg = row.config as { actorId: string };
    const actor: ActorContext = {
      workspaceId: row.workspaceId,
      userId: cfg.actorId,
      role: 'admin',
      correlationId,
    };
    const groups = (body.logGroups ?? []).filter((g) => typeof g === 'string').slice(0, 20);
    if (!body.accessKeyId || !body.secretAccessKey || !body.region)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'validation_failed', 'Missing key or region');
    if (groups.length === 0) {
      this.logger.warn(`AWS setup for workspace ${row.workspaceId} found no log groups`);
      return;
    }
    await this.tools.connectReader(actor, 'cloudwatch', {
      tool: 'cloudwatch',
      region: body.region,
      accessKeyId: body.accessKeyId,
      secretAccessKey: body.secretAccessKey,
      logGroups: groups,
    });
    await this.support.record(actor, 'setup.aws', {
      target: 'cloudwatch',
      region: body.region,
      logGroups: groups.length,
    });
  }
}
