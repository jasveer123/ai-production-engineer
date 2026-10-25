import type { Deployment, RepoCommit } from '@ape/api-contracts';

/**
 * Where a commit stands against the deploys we received: `live` is the newest deployed commit,
 * `pending` is newer than it (not deployed yet), `shipped` is older (already out), and `unknown`
 * means no deploy in the list matches any of these commits, so we do not guess.
 */
export type CommitState = 'live' | 'pending' | 'shipped' | 'unknown';

export type MarkedCommit = { commit: RepoCommit; state: CommitState; deploys: Deployment[] };

/** Deploy markers may carry a short SHA, so either one may be a prefix of the other. */
export function sameSha(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return Math.min(x.length, y.length) >= 7 && (x.startsWith(y) || y.startsWith(x));
}

/** `commits` newest first (as GitHub lists them), `deploys` newest first (as the API lists them). */
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
