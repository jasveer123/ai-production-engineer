import { z } from 'zod';
import {
  boundedUrlSchema,
  nameSchema,
  type IsoTimestamp,
  type Uuid,
  type WithSecret,
} from '../common';
import { severitySchema, type Severity } from '../incidents/status';

export const NOTIFICATION_EVENTS = [
  'incident.detected',
  'review.requested',
  'incident.needs_attention',
  'incident.resolved',
  'verification.inconclusive',
] as const;
export const notificationEventSchema = z.enum(NOTIFICATION_EVENTS);
export type NotificationEvent = z.infer<typeof notificationEventSchema>;

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  'incident.detected': 'New incident detected',
  'review.requested': 'Validated fix waiting for review',
  'incident.needs_attention': 'Incident needs attention (e.g. the fix did not work)',
  'incident.resolved': 'Incident resolved (recovery verified)',
  'verification.inconclusive': 'Recovery could not be verified',
};

export const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export const SLACK_WEBHOOK_PATTERN = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;

const channelName = nameSchema(80);
const channelEvents = z.array(notificationEventSchema).min(1).max(NOTIFICATION_EVENTS.length);
const minSeverity = severitySchema.default('low');

export const createNotificationChannelSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('slack'),
    name: channelName,
    webhookUrl: z
      .string()
      .regex(
        SLACK_WEBHOOK_PATTERN,
        'Use a Slack incoming webhook URL (https://hooks.slack.com/services/…)',
      ),
    events: channelEvents,
    minSeverity,
  }),
  z.object({
    kind: z.enum(['sms', 'phone']),
    name: channelName,
    phone: z
      .string()
      .trim()
      .regex(PHONE_PATTERN, 'Use the international format, like +14155550123'),
    events: channelEvents,
    minSeverity,
  }),
  z.object({
    kind: z.literal('push'),
    name: channelName,
    url: boundedUrlSchema,
    events: channelEvents,
    minSeverity,
  }),
  z.object({
    kind: z.enum(['webhook', 'teams']),
    name: channelName,
    url: boundedUrlSchema,
    events: channelEvents,
    minSeverity,
  }),
  z.object({
    kind: z.literal('email'),
    name: channelName,
    email: z.string().trim().email().max(320),
    events: channelEvents,
    minSeverity,
  }),
]);
export type CreateNotificationChannelInput = z.input<typeof createNotificationChannelSchema>;

export const updateNotificationChannelSchema = z.object({
  name: channelName.optional(),
  events: channelEvents.optional(),
  minSeverity: severitySchema.optional(),
  enabled: z.boolean().optional(),
});
export type UpdateNotificationChannelInput = z.infer<typeof updateNotificationChannelSchema>;

export interface NotificationChannel {
  id: Uuid;
  kind: ChannelKind;
  name: string;
  target: string;
  events: NotificationEvent[];
  minSeverity: Severity;
  enabled: boolean;
  lastDeliveryAt: IsoTimestamp | null;
  lastError: string | null;
  createdAt: IsoTimestamp;
}

export type NotificationChannelWithSecret = WithSecret<
  NotificationChannel,
  'signingSecret',
  string | null
>;

export type ChannelKind = 'slack' | 'webhook' | 'teams' | 'email' | 'sms' | 'phone' | 'push';

export const DELIVERY_STATES = [
  'queued',
  'leased',
  'provider_accepted',
  'delivered',
  'failed_permanent',
  'retry_wait',
  'outcome_unknown',
  'cancelled',
] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const DELIVERY_CHANNELS = [
  'email',
  'sms',
  'call',
  'push',
  'slack',
  'webhook',
  'teams',
] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export const deliveryQuerySchema = z.object({
  state: z.enum(DELIVERY_STATES).optional(),
  channel: z.enum(DELIVERY_CHANNELS).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type DeliveryQuery = z.infer<typeof deliveryQuerySchema>;

export interface DeliveryAttemptView {
  id: Uuid;
  incidentId: Uuid | null;
  runId: Uuid | null;
  stepIndex: number | null;
  eventType: string;
  channel: DeliveryChannel;
  channelName: string | null;
  recipientName: string | null;
  address: string;
  state: DeliveryState;
  attempts: number;
  maxAttempts: number;
  providerMessageId: string | null;
  responseStatus: number | null;
  error: string | null;
  nextAttemptAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  sentAt: IsoTimestamp | null;
  deliveredAt: IsoTimestamp | null;
}

export interface NotificationTestResult {
  ok: boolean;
  state: DeliveryState;
  status: number | null;
  error: string | null;
  providerMessageId: string | null;
}

export const CONTACT_KINDS = ['sms', 'call', 'push'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const createContactMethodSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.enum(['sms', 'call']),
    address: z
      .string()
      .trim()
      .regex(PHONE_PATTERN, 'Use the international format, like +14155550123'),
    minSeverity,
  }),
  z.object({ kind: z.literal('push'), address: boundedUrlSchema, minSeverity }),
]);
export type CreateContactMethodInput = z.input<typeof createContactMethodSchema>;

export interface ContactMethodView {
  id: Uuid;
  kind: ContactKind;
  address: string;
  minSeverity: Severity;
  createdAt: IsoTimestamp;
}

export interface NotificationProviders {
  email: boolean;
  twilio: boolean;
}
