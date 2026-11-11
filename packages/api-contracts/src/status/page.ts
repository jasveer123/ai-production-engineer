import { z } from 'zod';
import { nameSchema, uuidSchema, type IsoTimestamp, type Uuid } from '../common';

export const MAX_COMPONENTS = 30;
export const HISTORY_DAYS = 90;
export const UPDATE_STATES = ['investigating', 'identified', 'monitoring', 'resolved'] as const;
export type UpdateState = (typeof UPDATE_STATES)[number];

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single dashes');

export const createStatusPageSchema = z.object({
  name: nameSchema(80),
  slug: slugSchema,
  description: z.string().trim().max(300).optional(),
  monitorIds: z.array(uuidSchema).max(MAX_COMPONENTS).default([]),
});
export type CreateStatusPageInput = z.input<typeof createStatusPageSchema>;

export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/, 'Enter a domain like status.example.com');

export const subscribeSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
export type SubscribeInput = z.infer<typeof subscribeSchema>;

export const updateStatusPageSchema = z.object({
  name: nameSchema(80).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  monitorIds: z.array(uuidSchema).max(MAX_COMPONENTS).optional(),
  customDomain: domainSchema.nullable().optional(),
});
export type UpdateStatusPageInput = z.infer<typeof updateStatusPageSchema>;

export const postUpdateSchema = z.object({
  title: nameSchema(120),
  body: z.string().trim().max(2000).default(''),
  state: z.enum(UPDATE_STATES),
});
export type PostUpdateInput = z.input<typeof postUpdateSchema>;

export type OverallStatus = 'operational' | 'degraded' | 'outage';
export type ComponentState = 'up' | 'down' | 'pending';

export interface StatusDay {
  date: string;
  uptime: number | null;
}

export interface StatusComponent {
  name: string;
  state: ComponentState;
  uptime: number | null;
  days: StatusDay[];
}

export interface StatusUpdateView {
  id: Uuid;
  title: string;
  body: string;
  state: UpdateState;
  auto: boolean;
  createdAt: IsoTimestamp;
}

export interface PublicStatus {
  slug: string;
  name: string;
  description: string | null;
  overall: OverallStatus;
  components: StatusComponent[];
  updates: StatusUpdateView[];
  generatedAt: IsoTimestamp;
}

export interface StatusPageView {
  id: Uuid;
  name: string;
  slug: string;
  description: string | null;
  monitorIds: Uuid[];
  customDomain: string | null;
  domainToken: string | null;
  domainVerified: boolean;
  subscribers: number;
  updates: StatusUpdateView[];
  createdAt: IsoTimestamp;
}
