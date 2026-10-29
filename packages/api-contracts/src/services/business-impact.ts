import { z } from 'zod';
import { coercedInt, type IsoTimestamp, type Uuid } from '../common';

export const serviceValueSchema = z.object({
  valuePerRequest: z.number().positive().max(1_000_000).nullable(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code like USD or INR')
    .default('USD'),
});
export type ServiceValueInput = z.input<typeof serviceValueSchema>;

export const businessImpactQuerySchema = z.object({ days: coercedInt(90, 7) });
export type BusinessImpactQuery = z.input<typeof businessImpactQuerySchema>;

export interface ServiceImpact {
  serviceId: Uuid;
  serviceName: string;
  environment: string;
  valuePerRequest: number | null;
  currency: string | null;
  failedRequests: number;
  errorSpanTraces: number;
  incidentErrorEvents: number;
  incidents: number;
  impact: number | null;
}

export interface BusinessImpact {
  from: IsoTimestamp;
  to: IsoTimestamp;
  days: number;
  services: ServiceImpact[];
}
