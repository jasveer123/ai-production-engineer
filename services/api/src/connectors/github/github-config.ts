import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../core/common/errors';
import type { Integration } from '@ape/api-contracts';
import type { integrations } from '../../core/db/schema';

export type IntegrationRow = typeof integrations.$inferSelect;

export interface GitHubConfig {
  installationId: number;
  accountLogin: string;

  repositories: string[];

  grantedRepositories?: string[];

  accountType?: string;
  repositorySelection?: 'all' | 'selected';
  permissions?: Record<string, string>;
}

export const NEEDED_PERMISSIONS = {
  setupPullRequest: { contents: 'write', pull_requests: 'write' },
  deployWorkflow: { contents: 'write', pull_requests: 'write', workflows: 'write' },
} as const;

export function missingPermissions(
  granted: Record<string, string> | undefined,
  needed: Record<string, string>,
): string[] {
  return Object.entries(needed)
    .filter(([k, v]) => {
      const have = granted?.[k];
      return !(have === v || (v === 'read' && have === 'write'));
    })
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
}

export function pickRepositories(granted: string[], requested?: string[]): string[] {
  if (!requested) return granted;
  const allowed = new Set(granted.map((r) => r.toLowerCase()));
  const picked = requested.filter((r) => allowed.has(r.toLowerCase()));
  const unique = granted.filter((g) => picked.some((p) => p.toLowerCase() === g.toLowerCase()));
  if (!unique.length) {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      'repo_not_granted',
      'Select at least one repository this GitHub App installation can access.',
    );
  }
  return unique;
}

export function manageUrl(
  cfg: Pick<GitHubConfig, 'accountType' | 'accountLogin' | 'installationId'>,
) {
  return cfg.accountType === 'Organization'
    ? `https://github.com/organizations/${cfg.accountLogin}/settings/installations/${cfg.installationId}`
    : `https://github.com/settings/installations/${cfg.installationId}`;
}

export function githubScope(row: IntegrationRow): Partial<Integration> {
  const cfg = row.config as unknown as Partial<GitHubConfig>;
  return {
    scope: `Read code and history${cfg.repositories ? ` of ${cfg.repositories.length} repo(s): ${cfg.repositories.join(', ')}` : ''}. Writes only open a pull request on an ai-fix/* branch, after a human approves a validated fix.`,
  };
}
