import type { Deployment, RepoCommit } from '@ape/api-contracts';

export type CommitState = 'live' | 'pending' | 'shipped' | 'unknown';

export type MarkedCommit = { commit: RepoCommit; state: CommitState; deploys: Deployment[] };

export function sameSha(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return Math.min(x.length, y.length) >= 7 && (x.startsWith(y) || y.startsWith(x));
}

export function markCommits(commits: RepoCommit[], deploys: Deployment[]): MarkedCommit[] {
  const live = deploys[0];
  const liveIndex = live ? commits.findIndex((c) => sameSha(c.sha, live.commitSha)) : -1;
  return commits.map((commit, i) => ({
    commit,
    deploys: deploys.filter((d) => sameSha(commit.sha, d.commitSha)),
    state:
      liveIndex === -1
        ? 'unknown'
        : i < liveIndex
          ? 'pending'
          : i === liveIndex
            ? 'live'
            : 'shipped',
  }));
}
