import { z } from 'zod';
import { nameSchema, uuidSchema, type IsoTimestamp, type Uuid } from '../common';

export const RUM_EVENT_TYPES = ['pageview', 'error', 'click', 'vital', 'custom'] as const;
export type RumEventType = (typeof RUM_EVENT_TYPES)[number];
export const RUM_VITALS = ['LCP', 'CLS', 'INP', 'FCP', 'TTFB'] as const;
export const MAX_RUM_EVENTS = 200;
export const MAX_SNAPSHOT_CHARS = 1_500_000;

export const createRumAppSchema = z.object({ name: nameSchema(80) });
export type CreateRumAppInput = z.infer<typeof createRumAppSchema>;

const text = (max: number) => z.string().max(max);

export const rumEventSchema = z.object({
  ts: z.number().int().positive(),
  type: z.enum(RUM_EVENT_TYPES),
  name: text(120).default(''),
  url: text(2000).optional(),
  value: z.number().finite().optional(),
  props: z.record(z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).optional(),
});
export type RumEventInput = z.infer<typeof rumEventSchema>;

export const rumPayloadSchema = z.object({
  sessionId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  userId: text(120).optional(),
  userName: text(120).optional(),
  userEmail: text(200).optional(),
  url: text(2000),
  referrer: text(2000).optional(),
  viewport: z.object({ w: z.number().int().min(1).max(20000), h: z.number().int().min(1).max(20000) }).optional(),
  events: z.array(rumEventSchema).max(MAX_RUM_EVENTS).default([]),
  replay: z
    .object({
      snapshots: z
        .array(z.object({ ts: z.number().int().positive(), html: text(MAX_SNAPSHOT_CHARS), url: text(2000).optional() }))
        .max(5)
        .default([]),
      moves: z
        .array(
          z.object({
            ts: z.number().int().positive(),
            t: z.enum(['m', 'c', 's']),
            x: z.number().min(0).max(100000),
            y: z.number().min(0).max(100000),
          }),
        )
        .max(500)
        .default([]),
    })
    .optional(),
});
export type RumPayload = z.infer<typeof rumPayloadSchema>;

export const FUNNEL_STEP_KINDS = ['pageview', 'event'] as const;
export const funnelStepSchema = z.object({
  kind: z.enum(FUNNEL_STEP_KINDS),
  match: z.string().trim().min(1).max(200),
  label: z.string().trim().max(80).optional(),
});
export type FunnelStep = z.infer<typeof funnelStepSchema>;
export const createFunnelSchema = z.object({
  appId: uuidSchema,
  name: nameSchema(80),
  steps: z.array(funnelStepSchema).min(2).max(6),
});
export type CreateFunnelInput = z.infer<typeof createFunnelSchema>;

export const sessionQuerySchema = z.object({
  appId: uuidSchema.optional(),
  userId: z.string().trim().min(1).max(120).optional(),
  hasErrors: z.enum(['true', 'false']).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  minutes: z.coerce.number().int().min(5).max(43_200).default(1440),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export const rumRangeSchema = z.object({
  appId: uuidSchema.optional(),
  minutes: z.coerce.number().int().min(5).max(43_200).default(1440),
});

export interface RumAppView {
  id: Uuid;
  name: string;
  appKey: string;
  sessions24h: number;
  createdAt: IsoTimestamp;
}

export interface RumSessionView {
  id: Uuid;
  appId: Uuid;
  appName: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  startedAt: IsoTimestamp;
  lastSeenAt: IsoTimestamp;
  durationSeconds: number;
  pageViews: number;
  errors: number;
  clicks: number;
  entryUrl: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  hasReplay: boolean;
}

export interface RumEventView {
  id: number;
  ts: IsoTimestamp;
  type: RumEventType;
  name: string;
  url: string | null;
  value: number | null;
  props: Record<string, unknown>;
}

export interface RumSessionDetail extends RumSessionView {
  events: RumEventView[];
}

export interface RumReplay {
  viewport: { w: number; h: number } | null;
  startedAt: IsoTimestamp;
  snapshots: { ts: number; html: string; url: string | null }[];
  moves: { ts: number; t: 'm' | 'c' | 's'; x: number; y: number }[];
}

export interface RumVital {
  name: string;
  p75: number | null;
  samples: number;
}

export interface RumOverview {
  sessions: number;
  users: number;
  pageViews: number;
  errors: number;
  vitals: RumVital[];
  trend: { at: IsoTimestamp; sessions: number; errors: number }[];
  topPages: { url: string; views: number }[];
}

export interface RumUserView {
  userId: string;
  name: string | null;
  email: string | null;
  sessions: number;
  errors: number;
  lastSeenAt: IsoTimestamp;
}

export interface RumEventSummary {
  type: RumEventType;
  name: string;
  count: number;
  sessions: number;
}

export interface FunnelView {
  id: Uuid;
  appId: Uuid;
  name: string;
  steps: FunnelStep[];
  createdAt: IsoTimestamp;
}

export interface FunnelResult {
  funnel: FunnelView;
  steps: { label: string; sessions: number; conversion: number; dropOff: number }[];
}
