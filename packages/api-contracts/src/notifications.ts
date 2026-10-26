import { z } from 'zod';
import { Severity, severitySchema } from './incidents';

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

const channelEvents = z.array(notificationEventSchema).min(1).max(NOTIFICATION_EVENTS.length);
const channelName = z.string().trim().min(1).max(80);

export const SLACK_WEBHOOK_PATTERN = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;

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
    minSeverity: severitySchema.default('low'),
  }),
  z.object({
    kind: z.literal('webhook'),
    name: channelName,
    url: z.string().url().max(500),
    events: channelEvents,
    minSeverity: severitySchema.default('low'),
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
  id: string;
  kind: 'slack' | 'webhook';
  name: string;
  /** Where messages go, with any credential in the URL masked. */
  target: string;
  events: NotificationEvent[];
  minSeverity: Severity;
  enabled: boolean;
  lastDeliveryAt: string | null;
  lastError: string | null;
  createdAt: string;
}

/** Returned once on creation. Receivers verify `x-ape-signature` with this secret. */
export interface NotificationChannelWithSecret extends NotificationChannel {
  signingSecret: string | null;
}

export interface NotificationDelivery {
  id: string;
  channelId: string;
  channelName: string;
  eventType: string;
  incidentId: string | null;
  status: 'sent' | 'failed';
  attempts: number;
  responseStatus: number | null;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface NotificationTestResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}
