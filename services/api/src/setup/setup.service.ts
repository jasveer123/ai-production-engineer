import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, eq, gt, ne, sql } from 'drizzle-orm';
import type {
  AutoSetupInput,
  AwsSetupStart,
  DrainSetupResult,
  OAuthCallbackInput,
  OAuthCallbackResult,
  SetupCapabilities,
  SetupPrInput,
  SetupPrResult,
  ToolId,
} from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { newLinkToken, sha256 } from '../auth/password';
import { IngestTokensService } from '../collector/ingest-tokens.service';
import { SyslogServer } from '../collector/syslog.server';
import { ApiException, notFound } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { inboundEvents, integrations } from '../db/schema';
import { GitHubError } from '../github/github-app';
import { GitHubService, missingPermissions, NEEDED_PERMISSIONS } from '../github/github.service';
import { deployPayloadSchema } from '../ingestion/normalize';
import { SecretStore } from '../secrets/secret-store.service';
import type { FetchFn } from '../tools/readers';
import { ToolsService } from '../tools/tools.service';
import { cloudFormationCommand } from './aws';
import { fetchGitHubJwks, OidcError, verifyGitHubOidc, type JwksFetcher } from './github-oidc';
import {
  herokuAuthorizeUrl,
  herokuExchange,
  sentryExchange,
  sentryInstallUrl,
  sentryVerifyInstall,
  vercelExchange,
  vercelInstallUrl,
} from './oauth';
import { OAuthStateService } from './oauth-state.service';
import {
  listHerokuApps,
  ProvisionError,
  provisionBetterStack,
  provisionDatadog,
  provisionElasticsearch,
  provisionGrafana,
  provisionHerokuDrains,
  provisionRenderStream,
  provisionVercelDrain,
  type ProvisionResult,
} from './provisioners';
import {
  DEPLOY_WORKFLOW_PATH,
  deployWorkflow,
  detectProject,
  nodeChanges,
  pythonChanges,
  setupPrBody,
  type FileChanges,
} from './setup-pr';

/** Integration rows owned by the setup flows; hidden from the integrations list. */
export const SETUP_PROVIDERS = ['sentry_app', 'heroku_oauth', 'aws_setup'] as const;
const AWS_SETUP_TTL_MS = 2 * 60 * 60 * 1000;

const failed = (err: unknown) =>
  new ApiException(
    HttpStatus.BAD_GATEWAY,
    'setup_failed',
    err instanceof ProvisionError ? err.message : `Setup failed: ${(err as Error).message}`,
  );

@Injectable()
export class SetupService implements OnModuleInit {
  private readonly logger = new Logger(SetupService.name);
  /** Swappable in tests. */
  fetchFn: FetchFn = (...args) => fetch(...args);
  jwks: JwksFetcher = fetchGitHubJwks;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly audit: AuditService,
    private readonly secrets: SecretStore,
    private readonly state: OAuthStateService,
    private readonly github: GitHubService,
    private readonly tools: ToolsService,
    private readonly tokens: IngestTokensService,
    private readonly syslog: SyslogServer,
  ) {}

  onModuleInit(): void {
    // Sentry app tokens expire every 8 hours; refresh them before the AI reads Sentry.
    this.tools.refreshers.set('sentry', async (settings, secrets) => {
      if (settings.auth !== 'app' || !secrets.refreshToken || !this.sentryConfigured) return null;
      if (Date.parse(secrets.expiresAt ?? '') - Date.now() > 10 * 60_000) return null;
      const t = await sentryExchange(
        this.sentryCfg,
        settings.installationId!,
        { grant_type: 'refresh_token', refresh_token: secrets.refreshToken },
        this.fetchFn,
      );
      return { token: t.token, refreshToken: t.refreshToken, expiresAt: t.expiresAt };
    });
  }

  private get apiUrl() {
    return this.env.PUBLIC_API_URL.replace(/\/$/, '');
  }
  private get ingestUrl() {
    return (this.env.PUBLIC_INGEST_URL ?? this.env.PUBLIC_API_URL).replace(/\/$/, '');
  }
  private get sentryConfigured() {
    return Boolean(
      this.env.SENTRY_APP_SLUG && this.env.SENTRY_CLIENT_ID && this.env.SENTRY_CLIENT_SECRET,
    );
  }
  private get sentryCfg() {
    return {
      url: this.env.SENTRY_URL,
      clientId: this.env.SENTRY_CLIENT_ID!,
      clientSecret: this.env.SENTRY_CLIENT_SECRET!,
    };
  }
  private callbackUrl(provider: string) {
    return `${this.env.WEB_URL.replace(/\/$/, '')}/integrations/callback/${provider}/`;
  }

  private record(actor: ActorContext, action: string, metadata: Record<string, unknown>) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'setup',
      resourceId: typeof metadata.target === 'string' ? metadata.target : null,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata,
    });
  }

  capabilities(): SetupCapabilities {
    const local = /\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(this.ingestUrl);
    return {
      github: { configured: this.github.configured },
      oauth: {
        sentry: this.sentryConfigured,
        vercel: Boolean(
          this.env.VERCEL_INTEGRATION_SLUG &&
          this.env.VERCEL_CLIENT_ID &&
          this.env.VERCEL_CLIENT_SECRET,
        ),
        heroku: Boolean(this.env.HEROKU_CLIENT_ID && this.env.HEROKU_CLIENT_SECRET),
      },
      publicUrl: this.ingestUrl,
      publicUrlIsLocal: local,
      agent: {
        scriptUrl: `${this.apiUrl}/install/agent.sh`,
        kubernetesUrl: `${this.apiUrl}/install/kubernetes.yaml`,
      },
      syslog: this.env.SYSLOG_ENABLED
        ? { host: this.env.SYSLOG_PUBLIC_HOST, port: this.env.SYSLOG_PORT, tls: this.syslog.tls }
        : null,
    };
  }

  // ---------- GitHub: install link with state, connect on return ----------

  githubState(actor: ActorContext) {
    return this.state.issue(actor, 'github');
  }

  async githubCallback(
    actor: ActorContext,
    installationId: number,
    state: string,
  ): Promise<OAuthCallbackResult> {
    await this.state.verify(actor, 'github', state);
    const [mine] = await this.db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, actor.workspaceId),
          eq(integrations.provider, 'github'),
          eq(integrations.externalAccountId, String(installationId)),
          ne(integrations.status, 'disconnected'),
        ),
      );
    // GitHub's setup URL lands here with the installation. The user then picks which
    // repositories this workspace may use (Better Stack-style select page).
    if (mine) {
      const [row] = await this.db.select().from(integrations).where(eq(integrations.id, mine.id));
      const updated = await this.github.check(row!);
      return {
        provider: 'github',
        done: [
          `GitHub access updated: ${(updated.config as { repositories?: string[] }).repositories?.length ?? 0} repositories.`,
        ],
        todo: [],
        githubInstallationId: installationId,
      };
    }
    return {
      provider: 'github',
      done: [],
      todo: ['Select which repositories this workspace can use.'],
      githubInstallationId: installationId,
    };
  }

  // ---------- Setup pull requests (Way 1 and deploy markers) ----------

  async openSetupPr(
    actor: ActorContext,
    input: SetupPrInput & { environment: string },
  ): Promise<SetupPrResult> {
    const overview = await this.github.overview(actor);
    const inst = overview.installations.find((i) =>
      i.repositories.some((r) => r.toLowerCase() === input.repository.toLowerCase()),
    );
    if (!inst)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'repo_not_connected',
        overview.installations.length
          ? `The GitHub App cannot see ${input.repository}. Add it to the installation on GitHub (${overview.installations[0]!.manageUrl}), then try again.`
          : 'Connect GitHub first.',
      );
    const lacking = missingPermissions(
      inst.permissions,
      input.kind === 'deploy'
        ? NEEDED_PERMISSIONS.deployWorkflow
        : NEEDED_PERMISSIONS.setupPullRequest,
    );
    if (lacking.length)
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'github_permission',
        `The GitHub App is missing ${lacking.join(', ')}. Add it in the App's permissions${overview.appPermissionsUrl ? ` (${overview.appPermissionsUrl})` : ''}, then accept the new permissions on the installation (${inst.manageUrl}).`,
      );
    const installationId = inst.installationId;
    const gh = this.github.gh();
    const repo = input.repository;
    try {
      const meta = await gh.getRepo(installationId, repo);
      const baseSha = await gh.getBranchSha(installationId, repo, meta.default_branch);
      if (!baseSha)
        throw new ApiException(
          HttpStatus.CONFLICT,
          'empty_repo',
          'The repository has no commits yet',
        );
      const { paths } = await gh.tree(installationId, repo, baseSha);
      const read = (p: string) => gh.fileContent(installationId, repo, p, baseSha);

      let changes: FileChanges;
      if (input.kind === 'deploy') {
        changes = {
          files: {
            [DEPLOY_WORKFLOW_PATH]: deployWorkflow({
              service: input.service,
              environment: input.environment,
              apiUrl: this.apiUrl,
              audience: this.env.GITHUB_OIDC_AUDIENCE,
              branch: meta.default_branch,
            }),
          },
          done: [
            `Added \`${DEPLOY_WORKFLOW_PATH}\`: after each push to \`${meta.default_branch}\` it tells us which commit of \`${input.service}\` is live.`,
            'It signs in with the GitHub Actions OIDC token, so no secret was added to the repository.',
          ],
          todo: [
            'If you deploy from another workflow, move its "Send deploy marker" step to the end of that workflow.',
          ],
          language: null,
          needsLockfileUpdate: false,
        };
      } else {
        const project = detectProject(paths, input.directory || undefined);
        if (!project)
          throw new ApiException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'unknown_project',
            'No package.json, pyproject.toml or requirements.txt found. Set the app folder, or use OpenTelemetry or the HTTP API.',
          );
        const repoFiles = { paths, read };
        changes =
          project.language === 'node'
            ? await nodeChanges(
                repoFiles,
                project.dir,
                input.service,
                input.environment,
                this.ingestUrl,
              )
            : await pythonChanges(
                repoFiles,
                project.dir,
                input.service,
                input.environment,
                this.ingestUrl,
              );
        changes.todo.push(
          "Set `APE_TOKEN` (your workspace ingest token) in the app's environment, then deploy.",
        );
      }

      const branch = `ape/setup-${input.kind}-${input.service.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
      const title =
        input.kind === 'deploy'
          ? `Send deploy markers for ${input.service}`
          : `Connect ${input.service} to AI Production Engineer`;
      let existing = false;
      let headSha = await gh.getBranchSha(installationId, repo, branch);
      if (headSha) existing = true;
      else {
        const base = await gh.getCommit(installationId, repo, baseSha);
        const blobs = await Promise.all(
          Object.entries(changes.files).map(async ([path, content]) => ({
            path,
            sha: (await gh.createBlob(installationId, repo, content)).sha,
          })),
        );
        const tree = await gh.createTree(installationId, repo, base.tree.sha, blobs);
        const commit = await gh.createCommit(installationId, repo, title, tree.sha, baseSha);
        await gh.createBranch(installationId, repo, branch, commit.sha);
        headSha = commit.sha;
      }
      const prior = (await gh.listPullsForBranch(installationId, repo, branch)).find(
        (p) => p.state === 'open',
      );
      const draft = changes.needsLockfileUpdate;
      const pr =
        prior ??
        (await gh.createPull(installationId, repo, {
          title,
          body: setupPrBody(input.kind, changes),
          head: branch,
          base: meta.default_branch,
          draft,
        }));
      await this.record(actor, 'setup.pull_request', {
        target: `${repo}#${pr.number}`,
        kind: input.kind,
        service: input.service,
      });
      return {
        url: pr.html_url,
        number: pr.number,
        draft,
        existing: existing || Boolean(prior),
        language: changes.language,
        done: changes.done,
        todo: changes.todo,
      };
    } catch (err) {
      if (err instanceof ApiException) throw err;
      if (err instanceof GitHubError && err.status === 403)
        throw new ApiException(
          HttpStatus.FORBIDDEN,
          'github_permission',
          'The GitHub App needs "Contents: write", "Pull requests: write" and "Workflows: write" on this repository.',
        );
      throw err;
    }
  }

  /** Deploy markers from GitHub Actions, authenticated by the workflow's OIDC token. */
  async githubDeploy(
    bearer: string | undefined,
    body: unknown,
    correlationId: string,
  ): Promise<{ accepted: boolean; duplicate: boolean }> {
    let claims;
    try {
      claims = await verifyGitHubOidc(bearer ?? '', this.env.GITHUB_OIDC_AUDIENCE, this.jwks);
    } catch (err) {
      await this.audit.record({
        actorType: 'system',
        action: 'deploy.rejected',
        resourceType: 'deploy',
        outcome: 'denied',
        correlationId,
        metadata: { reason: (err as Error).message },
      });
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'invalid_token',
        err instanceof OidcError ? err.message : 'Invalid token',
      );
    }
    const parsed = deployPayloadSchema.safeParse(body);
    if (!parsed.success)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        parsed.error.issues[0]?.message ?? 'Invalid body',
      );
    const rows = await this.db
      .select()
      .from(integrations)
      .where(and(eq(integrations.provider, 'github'), ne(integrations.status, 'disconnected')));
    const owner = rows.find((r) =>
      ((r.config as { repositories?: string[] }).repositories ?? []).some(
        (x) => x.toLowerCase() === claims.repository.toLowerCase(),
      ),
    );
    if (!owner)
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'repo_not_connected',
        `${claims.repository} is not connected to any workspace`,
      );
    const inserted = await this.db
      .insert(inboundEvents)
      .values({
        workspaceId: owner.workspaceId,
        integrationId: owner.id,
        source: 'deploy_webhook',
        externalEventId: `gha:${claims.repository}:${claims.run_id ?? claims.jti ?? ''}:${parsed.data.service}:${parsed.data.commit_sha}`,
        payload: { ...parsed.data, repository: claims.repository },
      })
      .onConflictDoNothing()
      .returning({ id: inboundEvents.id });
    return { accepted: true, duplicate: inserted.length === 0 };
  }

  // ---------- Paste one admin key (Ways 6-7) ----------

  async autoSetupTool(
    actor: ActorContext,
    input: Extract<AutoSetupInput, object>,
  ): Promise<{ done: string[]; todo: string[]; tool: ToolId }> {
    const tool = input.tool as ToolId;
    const alerts = await this.tools.alertTarget(actor, tool);
    let result: ProvisionResult;
    try {
      switch (input.tool) {
        case 'grafana':
          result = await provisionGrafana(input, alerts, this.fetchFn);
          break;
        case 'datadog':
          result = await provisionDatadog(
            { site: input.site ?? 'datadoghq.com', apiKey: input.apiKey, appKey: input.appKey },
            alerts,
            this.fetchFn,
          );
          break;
        case 'elasticsearch':
          result = await provisionElasticsearch(
            {
              url: input.url,
              kibanaUrl: input.kibanaUrl,
              adminApiKey: input.adminApiKey,
              index: input.index ?? 'logs-*',
              serviceField: input.serviceField ?? 'service.name',
            },
            alerts,
            this.fetchFn,
          );
          break;
        case 'betterstack':
          result = await provisionBetterStack(input, alerts, this.fetchFn);
          break;
      }
    } catch (err) {
      throw failed(err);
    }
    if (result.reader) await this.tools.connectReader(actor, tool, result.reader);
    await this.record(actor, 'setup.tool_automated', { target: tool, done: result.done.length });
    return { tool, done: result.done, todo: result.todo };
  }

  // ---------- Log drains (Way 5) ----------

  private async drainToken(actor: ActorContext, name: string) {
    return (await this.tokens.create(actor, name)).token;
  }

  async vercelWithToken(
    actor: ActorContext,
    accessToken: string,
    teamId?: string | null,
  ): Promise<DrainSetupResult> {
    const ingestToken = await this.drainToken(actor, 'Vercel drain');
    try {
      const r = await provisionVercelDrain(
        { accessToken, teamId },
        {
          logsUrl: `${this.ingestUrl}/v1/drain`,
          tracesUrl: `${this.ingestUrl}/v1/traces`,
          ingestToken,
        },
        this.fetchFn,
      );
      await this.record(actor, 'setup.drain', { target: 'vercel' });
      return { done: r.done, todo: [], failed: [] };
    } catch (err) {
      throw failed(err);
    }
  }

  async herokuApps(actor: ActorContext, apiKey?: string): Promise<string[]> {
    try {
      return await listHerokuApps(apiKey || (await this.herokuToken(actor)), this.fetchFn);
    } catch (err) {
      throw failed(err);
    }
  }

  async herokuDrains(
    actor: ActorContext,
    apps: string[],
    apiKey?: string,
  ): Promise<DrainSetupResult> {
    const token = apiKey || (await this.herokuToken(actor));
    const ingestToken = await this.drainToken(actor, 'Heroku drain');
    const u = new URL(this.ingestUrl);
    const drainUrl = (app: string) =>
      `${u.protocol}//ape:${ingestToken}@${u.host}${u.pathname.replace(/\/$/, '')}/v1/drain?service=${encodeURIComponent(app)}`;
    try {
      const r = await provisionHerokuDrains(token, apps, drainUrl, this.fetchFn);
      await this.record(actor, 'setup.drain', { target: 'heroku', apps });
      return { done: r.done, todo: [], failed: r.failed };
    } catch (err) {
      throw failed(err);
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
        this.fetchFn,
      );
      await this.record(actor, 'setup.drain', { target: 'render' });
      return { done: r.done, todo, failed: [] };
    } catch (err) {
      throw failed(err);
    }
  }

  // ---------- Sign in and approve ----------

  async oauthStart(actor: ActorContext, provider: 'sentry' | 'vercel' | 'heroku'): Promise<string> {
    const caps = this.capabilities().oauth;
    if (!caps[provider])
      throw new ApiException(
        HttpStatus.CONFLICT,
        'not_configured',
        `${provider} sign-in is not configured on this server`,
      );
    const state = await this.state.issue(actor, provider);
    if (provider === 'sentry')
      return sentryInstallUrl(this.env.SENTRY_URL, this.env.SENTRY_APP_SLUG!, state);
    if (provider === 'vercel') return vercelInstallUrl(this.env.VERCEL_INTEGRATION_SLUG!, state);
    return herokuAuthorizeUrl(this.env.HEROKU_CLIENT_ID!, state);
  }

  async oauthCallback(
    actor: ActorContext,
    provider: 'sentry' | 'vercel' | 'heroku',
    input: OAuthCallbackInput,
  ): Promise<OAuthCallbackResult> {
    await this.state.verify(actor, provider, input.state);
    if (!input.code)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'missing_code',
        'The provider did not return an authorization code',
      );
    try {
      if (provider === 'vercel') {
        const t = await vercelExchange(
          {
            clientId: this.env.VERCEL_CLIENT_ID!,
            clientSecret: this.env.VERCEL_CLIENT_SECRET!,
            redirectUri: this.callbackUrl('vercel'),
          },
          input.code,
          this.fetchFn,
        );
        const r = await this.vercelWithToken(actor, t.accessToken, input.teamId ?? t.teamId);
        return { provider, done: r.done, todo: r.todo };
      }
      if (provider === 'heroku') {
        const t = await herokuExchange(
          { clientSecret: this.env.HEROKU_CLIENT_SECRET! },
          input.code,
          this.fetchFn,
        );
        await this.saveSetupRow(
          actor,
          'heroku_oauth',
          'Heroku',
          { expiresAt: new Date(Date.now() + t.expiresIn * 1000).toISOString() },
          { token: t.accessToken, refreshToken: t.refreshToken },
        );
        const apps = await listHerokuApps(t.accessToken, this.fetchFn);
        return {
          provider,
          done: ['Signed in to Heroku.'],
          todo: ['Choose the apps that should send logs.'],
          herokuApps: apps,
        };
      }
      return await this.sentryCallback(actor, input);
    } catch (err) {
      if (err instanceof ApiException) throw err;
      throw failed(err);
    }
  }

  private async sentryCallback(
    actor: ActorContext,
    input: OAuthCallbackInput,
  ): Promise<OAuthCallbackResult> {
    if (!input.installationId)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'missing_installation',
        'Sentry did not return an installation id',
      );
    const t = await sentryExchange(
      this.sentryCfg,
      input.installationId,
      { grant_type: 'authorization_code', code: input.code! },
      this.fetchFn,
    );
    const inst = (await (
      await this.fetchFn(
        `${this.env.SENTRY_URL.replace(/\/$/, '')}/api/0/sentry-app-installations/${encodeURIComponent(input.installationId)}/`,
        {
          headers: { Authorization: `Bearer ${t.token}` },
          signal: AbortSignal.timeout(15_000),
        },
      )
    ).json()) as { organization?: { slug?: string } };
    const org = inst.organization?.slug;
    if (!org) throw new ProvisionError('Sentry did not say which organization was installed');

    // Alerts arrive on our shared Sentry webhook and are routed by installation to this source.
    await this.tools.alertTarget(actor, 'sentry');
    const sourceId = (await this.tools.get(actor, 'sentry')).alerts.sourceId;
    await this.saveSetupRow(
      actor,
      'sentry_app',
      `Sentry (${org})`,
      { organization: org, alertSourceId: sourceId },
      {},
      input.installationId,
    );
    await this.tools.connectReader(actor, 'sentry', {
      tool: 'sentry',
      url: this.env.SENTRY_URL,
      organization: org,
      token: t.token,
    });
    // Keep the refresh token next to the access token so the refresher can renew it.
    await this.patchReaderSecrets(
      actor.workspaceId,
      'sentry',
      { token: t.token, refreshToken: t.refreshToken, expiresAt: t.expiresAt },
      { auth: 'app', installationId: input.installationId },
    );
    await sentryVerifyInstall(this.env.SENTRY_URL, input.installationId, t.token, this.fetchFn);
    await this.record(actor, 'setup.oauth', { target: 'sentry', organization: org });
    return {
      provider: 'sentry',
      done: [
        `Connected Sentry organization "${org}".`,
        'Sentry alerts open incidents here.',
        'The AI can read Sentry issues during investigations.',
      ],
      todo: [
        'In a Sentry alert rule, choose "Send a notification via AI Production Engineer" as an action.',
      ],
    };
  }

  private async patchReaderSecrets(
    workspaceId: string,
    tool: ToolId,
    secrets: Record<string, string>,
    settings: Record<string, string>,
  ) {
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, workspaceId),
          eq(integrations.provider, 'log_reader'),
          ne(integrations.status, 'disconnected'),
          sql`${integrations.config}->>'tool' = ${tool}`,
        ),
      );
    if (!row) return;
    const ref = await this.secrets.put(workspaceId, JSON.stringify(secrets));
    if (row.secretReference) await this.secrets.delete(workspaceId, row.secretReference);
    const cfg = row.config as { settings: Record<string, string> };
    await this.db
      .update(integrations)
      .set({
        secretReference: ref,
        config: { ...row.config, settings: { ...cfg.settings, ...settings } },
      })
      .where(eq(integrations.id, row.id));
  }

  /** One hidden row per provider and workspace (replaced on reconnect). */
  private async saveSetupRow(
    actor: ActorContext,
    provider: (typeof SETUP_PROVIDERS)[number],
    name: string,
    config: Record<string, unknown>,
    secrets: Record<string, string>,
    externalId?: string,
  ) {
    const ref = Object.keys(secrets).length
      ? await this.secrets.put(actor.workspaceId, JSON.stringify(secrets))
      : null;
    await this.db
      .update(integrations)
      .set({ status: 'disconnected' })
      .where(
        and(
          eq(integrations.workspaceId, actor.workspaceId),
          eq(integrations.provider, provider),
          ne(integrations.status, 'disconnected'),
        ),
      );
    await this.db.insert(integrations).values({
      workspaceId: actor.workspaceId,
      provider,
      name,
      config,
      secretReference: ref,
      externalAccountId: externalId ?? null,
      status: 'connected',
      lastSyncAt: new Date(),
    });
  }

  private async herokuToken(actor: ActorContext): Promise<string> {
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, actor.workspaceId),
          eq(integrations.provider, 'heroku_oauth'),
          ne(integrations.status, 'disconnected'),
        ),
      );
    const raw = row?.secretReference
      ? await this.secrets.get(actor.workspaceId, row.secretReference)
      : null;
    if (!raw)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'heroku_not_connected',
        'Sign in with Heroku or paste an API key first',
      );
    return (JSON.parse(raw) as { token: string }).token;
  }

  /** Routes a signed Sentry app webhook to the installing workspace's alert source. */
  async sentryWebhookTarget(
    installationUuid: string,
  ): Promise<{ workspaceId: string; alertSourceId: string | null; rowId: string } | null> {
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, 'sentry_app'),
          eq(integrations.externalAccountId, installationUuid),
          ne(integrations.status, 'disconnected'),
        ),
      );
    if (!row) return null;
    return {
      workspaceId: row.workspaceId,
      alertSourceId: (row.config as { alertSourceId?: string }).alertSourceId ?? null,
      rowId: row.id,
    };
  }

  async sentryUninstalled(rowId: string): Promise<void> {
    await this.db
      .update(integrations)
      .set({ status: 'disconnected', lastError: 'Uninstalled in Sentry' })
      .where(eq(integrations.id, rowId));
  }

  // ---------- AWS CloudWatch (one command) ----------

  async awsStart(actor: ActorContext): Promise<AwsSetupStart> {
    const alerts = await this.tools.alertTarget(actor, 'cloudwatch');
    const token = newLinkToken();
    const expiresAt = new Date(Date.now() + AWS_SETUP_TTL_MS);
    await this.saveSetupRow(
      actor,
      'aws_setup',
      'AWS setup',
      { tokenHash: sha256(token), expiresAt: expiresAt.toISOString(), actorId: actor.userId },
      {},
    );
    const templateUrl = `${this.apiUrl}/setup/aws/template.yaml`;
    return {
      templateUrl,
      expiresAt: expiresAt.toISOString(),
      command: cloudFormationCommand({
        templateUrl,
        callbackUrl: `${this.apiUrl}/setup/aws/callback/${token}`,
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
    await this.record(actor, 'setup.aws', {
      target: 'cloudwatch',
      region: body.region,
      logGroups: groups.length,
    });
  }
}
