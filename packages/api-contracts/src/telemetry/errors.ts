import { z } from 'zod';
import type { IsoTimestamp, Uuid } from '../common';

export const ERROR_STATUSES = ['unresolved', 'resolved', 'ignored'] as const;
export type ErrorStatus = (typeof ERROR_STATUSES)[number];

export const errorListQuerySchema = z.object({
  status: z.enum(ERROR_STATUSES).optional(),
  service: z.string().trim().min(1).max(120).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const updateErrorSchema = z.object({ status: z.enum(ERROR_STATUSES) });
export type UpdateErrorInput = z.infer<typeof updateErrorSchema>;

export interface ErrorGroupView {
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
  route: string | null;
  occurrences: ErrorOccurrenceView[];
  hourly: { at: IsoTimestamp; count: number }[];
}
