import { z } from 'zod';

export interface GitHubAppInfo {
  configured: boolean;
  slug: string | null;
  /** Includes a signed state, so GitHub's redirect back connects to this workspace. */
  installUrl: string | null;
  /** Installations of the App that are not yet connected to any workspace. */
  installations: { id: number; account: string; repositorySelection: 'all' | 'selected' }[];
  /**
   * Installations already connected to another workspace. The workspace is named only when the
   * caller is a member of it (otherwise null), so this does not reveal other tenants.
   */
  connectedElsewhere: {
    id: number;
    account: string;
    workspaceId: string | null;
    workspaceName: string | null;
  }[];
}

export const connectGitHubSchema = z.object({
  installationId: z.number().int().positive(),
  name: z.string().trim().min(1).max(80).default('GitHub'),
  /** Repositories this workspace may use. Omit to grant every repo the App installation can see. */
  repositories: z
    .array(z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Use the form owner/repo'))
    .min(1)
    .max(100)
    .optional(),
});
export type ConnectGitHubInput = z.input<typeof connectGitHubSchema>;

export interface GitHubSelectRepo {
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

/** GitHub accounts this workspace can connect, with the repositories each installation granted. */
export interface GitHubSelectView {
  configured: boolean;
  installUrl: string | null;
  accounts: {
    installationId: number;
    account: string;
    accountType: string | null;
    avatarUrl: string;
    repositorySelection: 'all' | 'selected';
    repositories: GitHubSelectRepo[];
    /** Already chosen for this workspace; all granted repos when not yet connected here. */
    selected: string[];
    connected: boolean;
    /** This workspace's connection for the account, so it can be disconnected; null when not connected. */
    integrationId: string | null;
  }[];
}

export interface RepositoryAccess {
  repositoryFullName: string;
  accessible: boolean;
  integrationId: string | null;
}

export interface RepoCommit {
  sha: string;
  message: string;
  author: string | null;
  date: string | null;
  url: string;
}
