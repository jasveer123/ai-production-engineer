import { z } from 'zod';

export const INCIDENT_STATUSES = [
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
] as const;
export const incidentStatusSchema = z.enum(INCIDENT_STATUSES);
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export const severitySchema = z.enum(SEVERITIES);
export type Severity = z.infer<typeof severitySchema>;

export const CLOSED_STATUSES: readonly IncidentStatus[] = ['resolved', 'closed_without_fix'];

export const INCIDENT_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  detected: ['investigating', 'needs_attention', 'closed_without_fix'],
  investigating: ['fix_proposed', 'needs_attention', 'closed_without_fix'],
  fix_proposed: ['validation', 'needs_attention', 'closed_without_fix'],
  validation: ['awaiting_review', 'validation_failed'],
  validation_failed: ['fix_proposed', 'needs_attention', 'closed_without_fix'],
  awaiting_review: ['monitoring', 'fix_proposed', 'closed_without_fix'],
  monitoring: ['resolved', 'needs_attention', 'verification_inconclusive'],
  verification_inconclusive: ['monitoring', 'resolved', 'needs_attention'],
  needs_attention: ['investigating', 'resolved', 'closed_without_fix'],
  resolved: ['needs_attention'],
  closed_without_fix: ['needs_attention'],
};
