import { z } from 'zod';
import type { IsoTimestamp, Uuid } from '../common';

export const ERROR_STATUSES = ['unresolved', 'resolved', 'ignored'] as const;
export type ErrorStatus = (typeof ERROR_STATUSES)[number];

export const errorListQuerySchema = z.object({
  status: z.enum(ERROR_STATUSES).optional(),
  service: z.string().trim().min(1).max(120).optional(),
  assignee: z.enum(['me', 'none']).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const updateErrorSchema = z
  .object({ status: z.enum(ERROR_STATUSES), assigneeId: z.string().uuid().nullable() })
  .partial()
  .refine((v) => v.status !== undefined || v.assigneeId !== undefined, {
    message: 'Send a status or an assignee',
  });
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
}
