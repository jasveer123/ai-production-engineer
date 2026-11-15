import { z } from 'zod';
import type { IsoTimestamp, Uuid } from '../common';

export const ERROR_STATUSES = [
  'unresolved',
  'resolved',
  'ignored',
  'snoozed',
  'regressed',
] as const;
export const ERROR_PLATFORMS = ['javascript', 'node', 'python', 'other'] as const;
export type ErrorPlatform = (typeof ERROR_PLATFORMS)[number];
export type ErrorStatus = (typeof ERROR_STATUSES)[number];

export const errorListQuerySchema = z.object({
  status: z.enum(ERROR_STATUSES).optional(),
  service: z.string().trim().min(1).max(120).optional(),
  assignee: z.enum(['me', 'none']).optional(),
  applicationId: z.string().uuid().optional(),
  environment: z.string().trim().min(1).max(120).optional(),
  release: z.string().trim().min(1).max(200).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const updateErrorSchema = z
  .object({
    status: z.enum(['unresolved', 'resolved', 'ignored', 'snoozed']),
    assigneeId: z.string().uuid().nullable(),
    snoozeMinutes: z.number().int().min(1).max(43_200),
    snoozeOccurrences: z.number().int().min(1).max(1_000_000),
  })
  .partial()
  .refine((v) => v.status !== undefined || v.assigneeId !== undefined, {
    message: 'Send a status or an assignee',
  })
  .refine(
    (v) =>
      v.status !== 'snoozed' || v.snoozeMinutes !== undefined || v.snoozeOccurrences !== undefined,
    { message: 'Snooze needs a duration or a number of occurrences' },
  );
export type UpdateErrorInput = z.infer<typeof updateErrorSchema>;

export interface ErrorAssignee {
  userId: Uuid;
  name: string | null;
  email: string;
}

export const sourceMapSchema = z.object({
  release: z.string().trim().min(1).max(100),
  file: z.string().trim().min(1).max(300),
  map: z.string().min(2).max(10_000_000),
});
export type SourceMapInput = z.infer<typeof sourceMapSchema>;

export interface SourceMapView {
  id: Uuid;
  release: string;
  file: string;
  sizeBytes: number;
  createdAt: IsoTimestamp;
}

export interface ErrorRelease {
  release: string;
  events: number;
  errors: number;
  newErrors: number;
  firstAt: IsoTimestamp;
  lastAt: IsoTimestamp;
}

export interface ErrorGroupView {
  assignee: ErrorAssignee | null;
  id: Uuid;
  title: string;
  errorType: string;
  message: string;
  service: string;
  environment: string;
  status: ErrorStatus;
  count: number;
  firstSeenAt: IsoTimestamp;
  lastSeenAt: IsoTimestamp;
  release: string | null;
  incidentId: Uuid | null;
  reopenedAt: IsoTimestamp | null;
  applicationId: Uuid | null;
  usersAffected: number;
  snoozeUntil: IsoTimestamp | null;
  snoozeRemaining: number | null;
}

export interface ErrorOccurrenceView {
  id: number;
  occurredAt: IsoTimestamp;
  traceId: string | null;
  release: string | null;
  message: string;
}

export interface ErrorGroupDetail extends ErrorGroupView {
  stack: string[];
  symbolicated: string[] | null;
  route: string | null;
  occurrences: ErrorOccurrenceView[];
  hourly: { at: IsoTimestamp; count: number }[];
  latest: ErrorEventDetail | null;
  rumSessionId: Uuid | null;
  byRelease: { release: string; count: number }[];
  byEnvironment: { environment: string; count: number }[];
  tagFacets: { key: string; values: { value: string; count: number }[] }[];
}

export interface ErrorFrameView {
  function: string | null;
  file: string | null;
  line: number | null;
  column: number | null;
  inApp: boolean;
  context: { pre: string[]; line: string; post: string[] } | null;
  mapped: boolean;
}

export interface ErrorExceptionView {
  type: string;
  value: string;
  frames: ErrorFrameView[];
}

export interface ErrorBreadcrumb {
  ts: number | null;
  category: string | null;
  level: string | null;
  message: string | null;
  type: string | null;
}

export interface ErrorEventDetail {
  eventId: string | null;
  occurredAt: IsoTimestamp;
  level: string | null;
  platform: string | null;
  exceptions: ErrorExceptionView[];
  breadcrumbs: ErrorBreadcrumb[];
  user: Record<string, string> | null;
  tags: Record<string, string>;
  contexts: Record<string, unknown>;
  request: { url: string | null; method: string | null } | null;
}

export const createErrorAppSchema = z.object({
  name: z.string().trim().min(1).max(80),
  platform: z.enum(ERROR_PLATFORMS).default('javascript'),
});
export type CreateErrorAppInput = z.infer<typeof createErrorAppSchema>;

export const updateErrorAppSchema = z.object({
  rateLimitPerMinute: z.number().int().min(1).max(100_000),
});
export type UpdateErrorAppInput = z.infer<typeof updateErrorAppSchema>;

export interface ErrorAppView {
  id: Uuid;
  name: string;
  platform: ErrorPlatform;
  publicKey: string;
  projectId: number;
  dsn: string;
  rateLimitPerMinute: number;
  droppedEvents: number;
  lastEventAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
}
