import { z } from 'zod';
import { optionalText, type Attributes, type IsoTimestamp, type Uuid } from '../common';

export interface ValidationRunView {
  id: Uuid;
  kind: 'baseline' | 'reproduction' | 'regression' | 'full_suite' | 'policy';
  attempt: number;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  durationMs: number | null;
  summary: Attributes;
  createdAt: IsoTimestamp;
}

export interface FixView {
  id: Uuid;
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
  createdAt: IsoTimestamp;
}

export interface PullRequestView {
  id: Uuid;
  incidentId: Uuid | null;
  incidentTitle: string | null;
  fixProposalId: Uuid | null;
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
  mergedAt: IsoTimestamp | null;
  lastSyncedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
}

export interface IncidentFixes {
  latest: FixView | null;
  versions: number;
  phase: string | null;
  pullRequest: PullRequestView | null;
}

export const FIX_ACTIONS = ['regenerate', 'reject', 'approve_pr'] as const;
export const fixActionSchema = z.object({
  action: z.enum(FIX_ACTIONS),
  note: optionalText(2000),
});
export type FixActionInput = z.infer<typeof fixActionSchema>;
