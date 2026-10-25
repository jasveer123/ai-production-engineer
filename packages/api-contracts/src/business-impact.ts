import { z } from 'zod';

export const serviceValueSchema = z.object({
  /** Business value of one successful request; null clears it. */
  valuePerRequest: z.number().positive().max(1_000_000).nullable(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code like USD or INR')
    .default('USD'),
});
export type ServiceValueInput = z.input<typeof serviceValueSchema>;

export const businessImpactQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});
export type BusinessImpactQuery = z.input<typeof businessImpactQuerySchema>;

export interface ServiceImpact {
  serviceId: string;
  serviceName: string;
  environment: string;
  valuePerRequest: number | null;
  currency: string | null;
  /** Distinct failed traces: error spans plus incident error events, each trace counted once. */
  failedRequests: number;
  errorSpanTraces: number;
  incidentErrorEvents: number;
  incidents: number;
  /** failedRequests × valuePerRequest, or null when no value is set. */
  impact: number | null;
}

export interface BusinessImpact {
  from: string;
  to: string;
  days: number;
  services: ServiceImpact[];
}
