import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { AutoSetupInput, DrainSetupResult, ToolId } from '@ape/api-contracts';
import { IngestTokensService } from '../../../ingest/collector/application/ingest-tokens.service';
import { SyslogServer } from '../../../ingest/collector/infrastructure/syslog.server';
import { ApiException } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { ToolsService } from '../../tools/tools.service';
import {
  listHerokuApps,
  provisionHerokuDrains,
  provisionRenderStream,
  provisionVercelDrain,
} from '../domain/drain-provisioners';
import {
  provisionBetterStack,
  provisionDatadog,
  provisionElasticsearch,
  provisionGrafana,
  type AlertTarget,
  type ProvisionResult,
} from '../domain/provisioners';
import { ingestUrl } from '../domain/setup-config';
import { SetupSupport, setupFailed } from './setup-support.service';

@Injectable()
export class ToolSetupService {
  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly support: SetupSupport,
    private readonly tools: ToolsService,
    private readonly tokens: IngestTokensService,
    private readonly syslog: SyslogServer,
  ) {}

  async autoSetupTool(
    actor: ActorContext,
    input: Extract<AutoSetupInput, object>,
  ): Promise<{ done: string[]; todo: string[]; tool: ToolId }> {
    const tool = input.tool as ToolId;
    const alerts = await this.tools.alertTarget(actor, tool);
    let result: ProvisionResult;
    try {
      result = await this.provision(input, alerts);
    } catch (err) {
      throw setupFailed(err);
    }
    if (result.reader) await this.tools.connectReader(actor, tool, result.reader);
    await this.support.record(actor, 'setup.tool_automated', {
      target: tool,
      done: result.done.length,
    });
    return { tool, done: result.done, todo: result.todo };
  }

  private provision(
    input: Extract<AutoSetupInput, object>,
    alerts: AlertTarget,
  ): Promise<ProvisionResult> {
    const fetchFn = this.support.fetchFn;
    switch (input.tool) {
      case 'grafana':
        return provisionGrafana(input, alerts, fetchFn);
      case 'datadog':
        return provisionDatadog(
          { site: input.site ?? 'datadoghq.com', apiKey: input.apiKey, appKey: input.appKey },
          alerts,
          fetchFn,
        );
      case 'elasticsearch':
        return provisionElasticsearch(
          {
            url: input.url,
            kibanaUrl: input.kibanaUrl,
            adminApiKey: input.adminApiKey,
            index: input.index ?? 'logs-*',
            serviceField: input.serviceField ?? 'service.name',
          },
          alerts,
          fetchFn,
        );
      case 'betterstack':
        return provisionBetterStack(input, alerts, fetchFn);
    }
  }

  private async drainToken(actor: ActorContext, name: string) {
    return (await this.tokens.create(actor, name)).token;
  }

  async vercelWithToken(
    actor: ActorContext,
    accessToken: string,
    teamId?: string | null,
  ): Promise<DrainSetupResult> {
    const ingestToken = await this.drainToken(actor, 'Vercel drain');
    const base = ingestUrl(this.env);
    try {
      const r = await provisionVercelDrain(
        { accessToken, teamId },
        { logsUrl: `${base}/v1/drain`, tracesUrl: `${base}/v1/traces`, ingestToken },
        this.support.fetchFn,
      );
      await this.support.record(actor, 'setup.drain', { target: 'vercel' });
      return { done: r.done, todo: [], failed: [] };
    } catch (err) {
      throw setupFailed(err);
    }
  }

  async herokuApps(actor: ActorContext, apiKey?: string): Promise<string[]> {
    try {
      return await listHerokuApps(
        apiKey || (await this.support.herokuToken(actor)),
        this.support.fetchFn,
      );
    } catch (err) {
      throw setupFailed(err);
    }
  }

  async herokuDrains(
    actor: ActorContext,
    apps: string[],
    apiKey?: string,
  ): Promise<DrainSetupResult> {
    const token = apiKey || (await this.support.herokuToken(actor));
    const ingestToken = await this.drainToken(actor, 'Heroku drain');
    const u = new URL(ingestUrl(this.env));
    const drainUrl = (app: string) =>
      `${u.protocol}//ape:${ingestToken}@${u.host}${u.pathname.replace(/\/$/, '')}/v1/drain?service=${encodeURIComponent(app)}`;
    try {
      const r = await provisionHerokuDrains(token, apps, drainUrl, this.support.fetchFn);
      await this.support.record(actor, 'setup.drain', { target: 'heroku', apps });
      return { done: r.done, todo: [], failed: r.failed };
    } catch (err) {
      throw setupFailed(err);
    }
  }

  async renderStream(actor: ActorContext, apiKey: string): Promise<DrainSetupResult> {
    if (!this.env.SYSLOG_ENABLED)
      throw new ApiException(
        HttpStatus.CONFLICT,
        'syslog_disabled',
        'Turn on SYSLOG_ENABLED to receive Render logs',
      );
    const ingestToken = await this.drainToken(actor, 'Render log stream');
    const todo = this.syslog.tls
      ? []
      : [
          'Render only streams over TLS: set SYSLOG_TLS_CERT_PATH and SYSLOG_TLS_KEY_PATH on this server.',
        ];
    try {
      const r = await provisionRenderStream(
        { apiKey },
        { endpoint: `${this.env.SYSLOG_PUBLIC_HOST}:${this.env.SYSLOG_PORT}`, token: ingestToken },
        this.support.fetchFn,
      );
      await this.support.record(actor, 'setup.drain', { target: 'render' });
      return { done: r.done, todo, failed: [] };
    } catch (err) {
      throw setupFailed(err);
    }
  }
}
