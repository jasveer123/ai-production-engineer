import { Inject, Injectable } from '@nestjs/common';
import type { SetupCapabilities } from '@ape/api-contracts';
import { SyslogServer } from '../../ingest/collector/infrastructure/syslog.server';
import { ENV, type ApiEnv } from '../../core/config/config.module';
import { GitHubService } from '../github/github.service';
import { apiUrl, ingestUrl } from './domain/setup-config';
import { OAuthSetupService } from './application/setup-oauth.service';

@Injectable()
export class SetupService {
  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly github: GitHubService,
    private readonly syslog: SyslogServer,
    private readonly oauth: OAuthSetupService,
  ) {}

  capabilities(): SetupCapabilities {
    const publicUrl = ingestUrl(this.env);
    const base = apiUrl(this.env);
    return {
      github: { configured: this.github.configured },
      oauth: this.oauth.configured(),
      publicUrl,
      publicUrlIsLocal: /\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(publicUrl),
      agent: {
        scriptUrl: `${base}/install/agent.sh`,
        kubernetesUrl: `${base}/install/kubernetes.yaml`,
      },
      syslog: this.env.SYSLOG_ENABLED
        ? { host: this.env.SYSLOG_PUBLIC_HOST, port: this.env.SYSLOG_PORT, tls: this.syslog.tls }
        : null,
    };
  }
}
