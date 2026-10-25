export interface ValidationRunView {
  id: string;
  kind: 'baseline' | 'reproduction' | 'regression' | 'full_suite' | 'policy';
  attempt: number;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  durationMs: number | null;
  summary: Record<string, unknown>;
  createdAt: string;
}

export interface FixView {
  id: string;
  version: number;
  status: string;
  statusReason: string | null;
  repositoryFullName: string | null;
  baseCommitSha: string;
  testPath: string | null;
  test: string | null;
  testRationale: string | null;
  diff: string | null;
  explanation: string | null;
  diffStat: { files: number; additions: number; deletions: number } | null;
  patchAttempts: number;
  runs: ValidationRunView[];
  createdAt: string;
}

export interface PullRequestView {
  id: string;
  incidentId: string | null;
  incidentTitle: string | null;
  fixProposalId: string | null;
  repositoryFullName: string | null;
  number: number | null;
  url: string | null;
  title: string | null;
  branchName: string;
  baseBranch: string | null;
  status: 'open' | 'merged' | 'closed';
  checksStatus: 'pending' | 'passing' | 'failing' | 'none';
  checks: { name: string; status: string; conclusion: string | null }[];
  approvedBy: string | null;
  mergedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface IncidentFixes {
  latest: FixView | null;
  versions: number;
  phase: string | null;
  pullRequest: PullRequestView | null;
}
