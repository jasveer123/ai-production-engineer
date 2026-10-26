import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('workspace_role', ['owner', 'admin', 'engineer', 'viewer']);
export const workspaceStatusEnum = pgEnum('workspace_status', ['active', 'suspended']);
export const integrationStatusEnum = pgEnum('integration_status', [
  'pending',
  'connected',
  'error',
  'disconnected',
]);
export const incidentStatusEnum = pgEnum('incident_status', [
  'detected',
  'investigating',
  'fix_proposed',
  'validation',
  'awaiting_review',
  'monitoring',
  'resolved',
  'needs_attention',
  'closed_without_fix',
  'validation_failed',
  'verification_inconclusive',
]);
export const severityEnum = pgEnum('severity', ['critical', 'high', 'medium', 'low']);
export const auditOutcomeEnum = pgEnum('audit_outcome', ['success', 'denied', 'failure']);
