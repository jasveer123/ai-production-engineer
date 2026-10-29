import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  autoSetupSchema,
  githubSetupCallbackSchema,
  herokuAppsSchema,
  herokuDrainSchema,
  oauthCallbackSchema,
  renderStreamSchema,
  setupPrSchema,
  vercelDrainSchema,
  type AutoSetupInput,
  type AutoSetupResult,
  type AwsSetupStart,
  type DrainSetupResult,
  type GitHubSetupCallbackInput,
  type HerokuApps,
  type OAuthCallbackInput,
  type OAuthCallbackResult,
  type OAuthStart,
  type SetupCapabilities,
  type SetupPrResult,
} from '@ape/api-contracts';
import type { Request } from 'express';
import type { z } from 'zod';
import { AlertSourcesService } from '../../modules/alerts/application/alert-sources.service';
import { Public } from '../../modules/auth/public.decorator';
import { Actor } from '../../core/common/actor.decorator';
import { ApiException, notFound } from '../../core/common/errors';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { ENV, type ApiEnv } from '../../core/config/config.module';
import { ToolsService } from '../tools/tools.service';
import { MinRole } from '../../modules/workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../../modules/workspaces/workspace-access.guard';
import { installScript, kubernetesManifest } from './domain/agent-install';
import { cloudFormationTemplate } from './domain/aws';
import { verifySentrySignature } from './domain/oauth';
import { ingestUrl } from './domain/setup-config';
import { AwsSetupService } from './application/setup-aws.service';
import { GitHubSetupService } from './application/setup-github.service';
import { OAuthSetupService } from './application/setup-oauth.service';
import { SetupSupport } from './application/setup-support.service';
import { ToolSetupService } from './application/setup-tools.service';
import { SetupService } from './setup.service';

const OAUTH_PROVIDERS = ['sentry', 'vercel', 'heroku'] as const;
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
const provider = (p: string): OAuthProvider => {
  if (!(OAUTH_PROVIDERS as readonly string[]).includes(p)) throw notFound('Provider');
  return p as OAuthProvider;
};

@Controller('workspaces/:workspaceId/setup')
@UseGuards(WorkspaceAccessGuard)
export class SetupController {
  constructor(
    private readonly setup: SetupService,
    private readonly githubSetup: GitHubSetupService,
    private readonly oauthSetup: OAuthSetupService,
    private readonly awsSetup: AwsSetupService,
  ) {}

  @Get('capabilities')
  capabilities(): SetupCapabilities {
    return this.setup.capabilities();
  }

  @Get('github/state')
  @MinRole('admin')
  async githubState(@Actor() actor: ActorContext): Promise<{ state: string }> {
    return { state: await this.githubSetup.githubState(actor) };
  }

  @Post('github/callback')
  @MinRole('admin')
  @HttpCode(200)
  githubCallback(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(githubSetupCallbackSchema)) body: GitHubSetupCallbackInput,
  ): Promise<OAuthCallbackResult> {
    return this.githubSetup.githubCallback(actor, Number(body.installationId), body.state);
  }

  @Post('pull-requests')
  @MinRole('admin')
  pullRequest(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(setupPrSchema)) body: z.output<typeof setupPrSchema>,
  ): Promise<SetupPrResult> {
    return this.githubSetup.openSetupPr(actor, body);
  }

  @Get('oauth/:provider/start')
  @MinRole('admin')
  async oauthStart(
    @Actor() actor: ActorContext,
    @Param('provider') p: string,
  ): Promise<OAuthStart> {
    return { url: await this.oauthSetup.oauthStart(actor, provider(p)) };
  }

  @Post('oauth/:provider/callback')
  @MinRole('admin')
  @HttpCode(200)
  oauthCallback(
    @Actor() actor: ActorContext,
    @Param('provider') p: string,
    @Body(new ZodValidationPipe(oauthCallbackSchema)) body: OAuthCallbackInput,
  ): Promise<OAuthCallbackResult> {
    return this.oauthSetup.oauthCallback(actor, provider(p), body);
  }

  @Post('aws')
  @MinRole('admin')
  aws(@Actor() actor: ActorContext): Promise<AwsSetupStart> {
    return this.awsSetup.awsStart(actor);
  }
}

@Controller('workspaces/:workspaceId/setup')
@UseGuards(WorkspaceAccessGuard)
export class SetupToolsController {
  constructor(
    private readonly toolSetup: ToolSetupService,
    private readonly tools: ToolsService,
  ) {}

  @Post('tools')
  @MinRole('admin')
  async autoTool(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(autoSetupSchema)) body: AutoSetupInput,
  ): Promise<AutoSetupResult> {
    const r = await this.toolSetup.autoSetupTool(actor, body);
    return { tool: await this.tools.get(actor, r.tool), done: r.done, todo: r.todo };
  }

  @Post('drains/vercel')
  @MinRole('admin')
  vercel(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(vercelDrainSchema)) body: z.output<typeof vercelDrainSchema>,
  ): Promise<DrainSetupResult> {
    return this.toolSetup.vercelWithToken(actor, body.accessToken, body.teamId);
  }

  @Post('drains/heroku/apps')
  @MinRole('admin')
  @HttpCode(200)
  async herokuApps(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(herokuAppsSchema)) body: z.output<typeof herokuAppsSchema>,
  ): Promise<HerokuApps> {
    return { apps: await this.toolSetup.herokuApps(actor, body.apiKey) };
  }

  @Post('drains/heroku')
  @MinRole('admin')
  heroku(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(herokuDrainSchema)) body: z.output<typeof herokuDrainSchema>,
  ): Promise<DrainSetupResult> {
    return this.toolSetup.herokuDrains(actor, body.apps, body.apiKey);
  }

  @Post('drains/render')
  @MinRole('admin')
  render(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(renderStreamSchema)) body: z.output<typeof renderStreamSchema>,
  ): Promise<DrainSetupResult> {
    return this.toolSetup.renderStream(actor, body.apiKey);
  }
}

@Controller()
export class SetupPublicController {
  constructor(
    private readonly githubSetup: GitHubSetupService,
    private readonly awsSetup: AwsSetupService,
    private readonly support: SetupSupport,
    private readonly alertSources: AlertSourcesService,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  @Public()
  @Get('install/agent.sh')
  @Header('Content-Type', 'text/x-shellscript; charset=utf-8')
  agentScript(): string {
    return installScript(ingestUrl(this.env));
  }

  @Public()
  @Get('install/kubernetes.yaml')
  @Header('Content-Type', 'application/yaml; charset=utf-8')
  kubernetes(@Query('service') service?: string): string {
    const svc = /^[A-Za-z0-9._-]{1,100}$/.test(service ?? '') ? service! : 'kubernetes';
    return kubernetesManifest(ingestUrl(this.env), svc);
  }

  @Public()
  @Get('setup/aws/template.yaml')
  @Header('Content-Type', 'application/yaml; charset=utf-8')
  awsTemplate(): string {
    return cloudFormationTemplate();
  }

  @Public()
  @Post('setup/aws/callback/:token')
  @HttpCode(204)
  async awsCallback(
    @Param('token') token: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<void> {
    await this.awsSetup.awsCallback(token, body, req.correlationId);
  }

  @Public()
  @Post('ingest/github-deploys')
  @HttpCode(HttpStatus.ACCEPTED)
  githubDeploy(@Req() req: Request) {
    const auth = req.header('authorization');
    const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : undefined;
    return this.githubSetup.githubDeploy(bearer, req.body, req.correlationId);
  }

  @Public()
  @Post('ingest/sentry-app')
  @HttpCode(HttpStatus.ACCEPTED)
  async sentryApp(@Req() req: Request): Promise<{ accepted: boolean }> {
    const secret = this.env.SENTRY_CLIENT_SECRET;
    if (
      !secret ||
      !verifySentrySignature(
        secret,
        req.rawBody ?? Buffer.alloc(0),
        req.header('sentry-hook-signature'),
      )
    )
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'invalid_signature',
        'Signature check failed',
      );
    const body = req.body as {
      action?: string;
      installation?: { uuid?: string };
      data?: Record<string, unknown>;
    };
    const resource = req.header('sentry-hook-resource') ?? '';
    const target = body.installation?.uuid
      ? await this.support.sentryWebhookTarget(body.installation.uuid)
      : null;
    if (!target) return { accepted: false };
    if (resource === 'installation' && body.action === 'deleted') {
      await this.support.sentryUninstalled(target.rowId);
      return { accepted: true };
    }
    if (
      !['event_alert', 'issue', 'metric_alert', 'error'].includes(resource) ||
      !target.alertSourceId
    )
      return { accepted: false };
    const row = await this.alertSources.row(target.alertSourceId);
    if (!row) return { accepted: false };
    const id =
      req.header('request-id') ??
      req.header('sentry-hook-timestamp') ??
      `${resource}:${Date.now()}`;
    await this.alertSources.buffer(row, `sentry-app:${id}`, body);
    return { accepted: true };
  }
}
