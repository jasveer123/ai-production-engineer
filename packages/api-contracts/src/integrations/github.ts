import { z } from 'zod';
import {
  nameSchema,
  repoFullNameSchema,
  type ConnectionStatus,
  type RepositorySelection,
  type Uuid,
  type IsoTimestamp,
} from '../common';

export interface GitHubInstallation {
  id: number;
  account: string;
}

export interface GitHubAppInfo {
  configured: boolean;
  slug: string | null;
  installUrl: string | null;
  installations: (GitHubInstallation & { repositorySelection: RepositorySelection })[];
  connectedElsewhere: (GitHubInstallation & {
    workspaceId: Uuid | null;
    workspaceName: string | null;
  })[];
}

export const connectGitHubSchema = z.object({
  installationId: z.number().int().positive(),
  name: nameSchema(80).default('GitHub'),
  repositories: z.array(repoFullNameSchema).min(1).max(100).optional(),
});
export type ConnectGitHubInput = z.input<typeof connectGitHubSchema>;

export interface GitHubSelectRepo {
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

export interface GitHubSelectView {
  configured: boolean;
  installUrl: string | null;
  accounts: {
    installationId: number;
    account: string;
    accountType: string | null;
    avatarUrl: string;
    repositorySelection: RepositorySelection;
    repositories: GitHubSelectRepo[];
    selected: string[];
    connected: boolean;
    integrationId: Uuid | null;
  }[];
}

export interface RepositoryAccess {
  repositoryFullName: string;
  accessible: boolean;
  integrationId: Uuid | null;
}

export interface RepoCommit {
  sha: string;
  message: string;
  author: string | null;
  date: IsoTimestamp | null;
  url: string;
}

export interface GitHubOverview {
  configured: boolean;
  installations: {
    integrationId: Uuid;
    installationId: number;
    account: string;
    status: ConnectionStatus;
    lastError: string | null;
    repositorySelection: RepositorySelection | null;
    repositories: string[];
    permissions: Record<string, string>;
    manageUrl: string;
  }[];
  missing: { setupPullRequest: string[]; deployWorkflow: string[] };
  appPermissionsUrl: string | null;
  unreachableServiceRepos: string[];
}
