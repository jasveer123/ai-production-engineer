import { z } from 'zod';
import {
  coercedInt,
  uuidSchema,
  type IsoTimestamp,
  type Labels,
  type Uuid,
  type ValueOf,
} from '../common';
import type { Severity } from '../incidents/status';
import type { AlertSourceKind } from './sources';

export const ALERT_STATES = ['firing', 'resolved'] as const;
export type AlertState = ValueOf<typeof ALERT_STATES>;

export const alertPreviewSchema = z.object({ sourceId: uuidSchema, payload: z.unknown() });

export const alertListQuerySchema = z.object({
  status: z.enum(ALERT_STATES).optional(),
  sourceId: uuidSchema.optional(),
  incidentId: uuidSchema.optional(),
  limit: coercedInt(200, 100),
});
export type AlertListQuery = z.input<typeof alertListQuerySchema>;

export interface AlertView {
  id: Uuid;
  sourceId: Uuid;
  sourceName: string;
  sourceKind: AlertSourceKind;
  routeId: Uuid | null;
  routeName: string | null;
  incidentId: Uuid | null;
  incidentTitle: string | null;
  status: AlertState;
  title: string;
  description: string | null;
  severity: Severity;
  labels: Labels;
  sourceUrl: string | null;
  occurrences: number;
  firstFiredAt: IsoTimestamp;
  lastFiredAt: IsoTimestamp;
  resolvedAt: IsoTimestamp | null;
}

export interface AlertPreview {
  alerts: (Pick<AlertView, 'title' | 'status' | 'severity' | 'labels'> & {
    dedupKey: string;
    route: { id: Uuid; name: string } | null;
    groupKey: string | null;
    createsIncident: boolean;
  })[];
  error: string | null;
}
