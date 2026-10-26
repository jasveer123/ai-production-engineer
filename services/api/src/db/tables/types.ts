import { type incidentStatusEnum, type roleEnum, type severityEnum } from './enums';

export type Role = (typeof roleEnum.enumValues)[number];
export type Severity = (typeof severityEnum.enumValues)[number];
export type IncidentStatus = (typeof incidentStatusEnum.enumValues)[number];

export interface SeverityRule {
  environment?: string;
  serviceName?: string;
  errorType?: string;
  severity: Severity;
}

export interface SandboxProfile {
  runtime: 'node22-pnpm';
  /** Package directory inside the repo, e.g. "api". */
  packageDir: string;
  /** Run inside packageDir; must accept extra test file paths as arguments. */
  testCommand: string;
  /** Where generated regression tests go, relative to packageDir. */
  testDir: string;
}

export interface ApprovalPolicy {
  /** Lowest role allowed to approve a pull request. */
  prMinRole: Role;
}

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = { prMinRole: 'engineer' };
export const APPROVAL_POLICY_VERSION = 'pr-approval-v1';

export interface WorkspaceSettings {
  severityRules?: SeverityRule[];
  approvalPolicy?: ApprovalPolicy;
}
