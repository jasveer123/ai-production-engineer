import { createSign } from 'node:crypto';

export interface GitHubInstallation {
  id: number;
  account: { login: string; type: string } | null;
  repository_selection: 'all' | 'selected';
  permissions: Record<string, string>;
  suspended_at: string | null;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
  default_branch: string;
  private: boolean;
}

export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } | null };
}

export interface GitHubPull {
  id: number;
  number: number;
  html_url: string;
  state: 'open' | 'closed';
  merged?: boolean;
  merged_at: string | null;
  merge_commit_sha: string | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  title: string;
}

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

/** RS256 JWT that authenticates as the App itself (valid ~9 minutes). */
export function appJwt(
  appId: string,
  privateKeyPem: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  // Backdated 60 s to tolerate clock drift, as GitHub recommends.
  const payload = b64url(
    JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 540, iss: appId }),
  );
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKeyPem);
  return `${header}.${payload}.${b64url(signature)}`;
}

/**
 * Minimal GitHub App client. Installation tokens are short-lived (1 h), kept only in memory and
 * never stored in the database. Write calls (branches, PRs) are added in Phase 6, behind approval.
 */
export class GitHubAppClient {
  private tokens = new Map<number, { token: string; expiresAt: number }>();

  constructor(
    private readonly appId: string,
    private readonly privateKeyPem: string,
    private readonly apiUrl = 'https://api.github.com',
  ) {}

  private async request<T>(path: string, auth: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ai-production-engineer',
        Authorization: auth,
        ...init.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new GitHubError(res.status, `GitHub ${res.status}: ${body.message ?? res.statusText}`);
    }
    return (await res.json()) as T;
  }

  private asApp<T>(path: string, init?: RequestInit) {
    return this.request<T>(path, `Bearer ${appJwt(this.appId, this.privateKeyPem)}`, init);
  }

  private async installationToken(installationId: number): Promise<string> {
    const cached = this.tokens.get(installationId);
    if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached.token;
    const res = await this.asApp<{ token: string; expires_at: string }>(
      `/app/installations/${installationId}/access_tokens`,
      { method: 'POST' },
    );
    this.tokens.set(installationId, { token: res.token, expiresAt: Date.parse(res.expires_at) });
    return res.token;
  }

  private async asInstallation<T>(
    installationId: number,
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    return this.request<T>(path, `token ${await this.installationToken(installationId)}`, init);
  }

  private post<T>(installationId: number, path: string, body: unknown): Promise<T> {
    return this.asInstallation<T>(installationId, path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ----- Writes (Phase 6). Only called after an approval, re-checked at execution time. -----

  getCommit(installationId: number, repo: string, sha: string) {
    return this.asInstallation<{ sha: string; tree: { sha: string } }>(
      installationId,
      `/repos/${repo}/git/commits/${sha}`,
    );
  }

  createBlob(installationId: number, repo: string, content: string) {
    return this.post<{ sha: string }>(installationId, `/repos/${repo}/git/blobs`, {
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64',
    });
  }

  createTree(
    installationId: number,
    repo: string,
    baseTree: string,
    files: { path: string; sha: string }[],
  ) {
    return this.post<{ sha: string }>(installationId, `/repos/${repo}/git/trees`, {
      base_tree: baseTree,
      tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', sha: f.sha })),
    });
  }

  createCommit(
    installationId: number,
    repo: string,
    message: string,
    tree: string,
    parent: string,
  ) {
    return this.post<{ sha: string }>(installationId, `/repos/${repo}/git/commits`, {
      message,
      tree,
      parents: [parent],
    });
  }

  /** The branch's head sha, or null when the branch does not exist. */
  async getBranchSha(installationId: number, repo: string, branch: string): Promise<string | null> {
    try {
      const r = await this.asInstallation<{ object: { sha: string } }>(
        installationId,
        `/repos/${repo}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`,
      );
      return r.object.sha;
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) return null;
      throw err;
    }
  }

  createBranch(installationId: number, repo: string, branch: string, sha: string) {
    return this.post<{ ref: string }>(installationId, `/repos/${repo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha,
    });
  }

  /** Pull requests (any state) whose head is `owner:branch`. */
  listPullsForBranch(installationId: number, repo: string, branch: string) {
    const owner = repo.split('/')[0];
    return this.asInstallation<GitHubPull[]>(
      installationId,
      `/repos/${repo}/pulls?state=all&head=${encodeURIComponent(`${owner}:${branch}`)}`,
    );
  }

  createPull(
    installationId: number,
    repo: string,
    pr: { title: string; body: string; head: string; base: string; draft?: boolean },
  ) {
    return this.post<GitHubPull>(installationId, `/repos/${repo}/pulls`, pr);
  }

  getPull(installationId: number, repo: string, number: number) {
    return this.asInstallation<GitHubPull>(installationId, `/repos/${repo}/pulls/${number}`);
  }

  async checkRuns(installationId: number, repo: string, sha: string) {
    const r = await this.asInstallation<{
      check_runs: { name: string; status: string; conclusion: string | null }[];
    }>(installationId, `/repos/${repo}/commits/${sha}/check-runs?per_page=100`);
    return r.check_runs;
  }

  /**
   * Whether `head` contains `base` (Phase 7: is the merge commit part of the deployed commit?).
   * GitHub's compare status is "ahead" or "identical" exactly when it does.
   */
  async contains(installationId: number, repo: string, head: string, base: string) {
    const r = await this.asInstallation<{ status: string }>(
      installationId,
      `/repos/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    );
    return r.status === 'ahead' || r.status === 'identical';
  }

  /** Drops a cached token, e.g. after the installation was removed. */
  forget(installationId: number) {
    this.tokens.delete(installationId);
  }

  app() {
    return this.asApp<{ id: number; slug: string; name: string; html_url: string }>('/app');
  }

  listInstallations() {
    return this.asApp<GitHubInstallation[]>('/app/installations?per_page=100');
  }

  /** 404 means the App was uninstalled (revoked) from that account. */
  getInstallation(installationId: number) {
    return this.asApp<GitHubInstallation>(`/app/installations/${installationId}`);
  }

  async listRepositories(installationId: number): Promise<GitHubRepo[]> {
    const res = await this.asInstallation<{ repositories: GitHubRepo[] }>(
      installationId,
      '/installation/repositories?per_page=100',
    );
    return res.repositories;
  }

  listCommits(
    installationId: number,
    repo: string,
    opts: { sha?: string; since?: string; path?: string; limit?: number } = {},
  ) {
    const q = new URLSearchParams({ per_page: String(opts.limit ?? 10) });
    if (opts.sha) q.set('sha', opts.sha);
    if (opts.path) q.set('path', opts.path);
    if (opts.since) q.set('since', opts.since);
    return this.asInstallation<GitHubCommit[]>(
      installationId,
      `/repos/${repo}/commits?${q.toString()}`,
    );
  }

  compare(installationId: number, repo: string, base: string, head: string) {
    return this.asInstallation<{
      status: string;
      total_commits: number;
      files?: {
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        patch?: string;
      }[];
    }>(
      installationId,
      `/repos/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    );
  }

  /** The repository as a .tar.gz at an exact commit (for the sandbox). */
  async tarball(installationId: number, repo: string, sha: string): Promise<Buffer> {
    const res = await fetch(`${this.apiUrl}/repos/${repo}/tarball/${encodeURIComponent(sha)}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ai-production-engineer',
        Authorization: `token ${await this.installationToken(installationId)}`,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new GitHubError(res.status, `GitHub ${res.status}: tarball download failed`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** All file paths at a ref (used to map runtime stack-frame paths to repository paths). */
  async tree(
    installationId: number,
    repo: string,
    ref: string,
  ): Promise<{ paths: string[]; truncated: boolean }> {
    const res = await this.asInstallation<{
      tree: { path: string; type: string }[];
      truncated: boolean;
    }>(installationId, `/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
    return {
      paths: res.tree.filter((t) => t.type === 'blob').map((t) => t.path),
      truncated: res.truncated,
    };
  }

  async fileContent(
    installationId: number,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string> {
    const q = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const res = await this.asInstallation<{ content: string; encoding: string }>(
      installationId,
      `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}${q}`,
    );
    return Buffer.from(res.content, res.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
  }
}
