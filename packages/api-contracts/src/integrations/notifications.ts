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
    kind: z.literal('webhook'),
    name: channelName,
    url: boundedUrlSchema,
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
  kind: 'slack' | 'webhook';
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

export interface NotificationDelivery {
  id: Uuid;
  channelId: Uuid;
  channelName: string;
  eventType: string;
  incidentId: Uuid | null;
  status: 'sent' | 'failed';
  attempts: number;
  responseStatus: number | null;
  error: string | null;
  createdAt: IsoTimestamp;
  sentAt: IsoTimestamp | null;
}

export interface NotificationTestResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}
