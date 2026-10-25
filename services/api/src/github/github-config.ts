import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/errors';
import type { integrations } from '../db/schema';

export type IntegrationRow = typeof integrations.$inferSelect;

export interface GitHubConfig {
  installationId: number;
  accountLogin: string;
  /** Repositories this workspace may use (a subset of the App installation). */
  repositories: string[];
  /** Every repository the App installation currently grants. */
  grantedRepositories?: string[];
  /** Refreshed by check(); absent on rows connected before they were recorded. */
  accountType?: string;
  repositorySelection?: 'all' | 'selected';
  permissions?: Record<string, string>;
}

/** Permissions each automation needs on the GitHub App installation. */
export const NEEDED_PERMISSIONS = {
  setupPullRequest: { contents: 'write', pull_requests: 'write' },
  deployWorkflow: { contents: 'write', pull_requests: 'write', workflows: 'write' },
} as const;

/** "contents: write" style list of what `granted` lacks. */
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

/** Where an account admin can change what the App installation may do. */
export function manageUrl(
  cfg: Pick<GitHubConfig, 'accountType' | 'accountLogin' | 'installationId'>,
) {
  return cfg.accountType === 'Organization'
    ? `https://github.com/organizations/${cfg.accountLogin}/settings/installations/${cfg.installationId}`
    : `https://github.com/settings/installations/${cfg.installationId}`;
}
