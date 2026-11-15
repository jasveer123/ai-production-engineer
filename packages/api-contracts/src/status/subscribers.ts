import { z } from 'zod';
import type { IsoTimestamp, Uuid } from '../common';

export const addSubscriberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
export type AddSubscriberInput = z.infer<typeof addSubscriberSchema>;

export type SubscriberState = 'pending' | 'confirmed' | 'unsubscribed';
export type SubscriberDeliveryState = 'pending' | 'sent' | 'failed' | 'skipped';

export interface SubscriberView {
  id: Uuid;
  email: string;
  state: SubscriberState;
  createdAt: IsoTimestamp;
}

export interface NotificationView {
  id: Uuid;
  subject: string;
  createdAt: IsoTimestamp;
  deliverAfter: IsoTimestamp;
  fannedOut: boolean;
  counts: Record<SubscriberDeliveryState, number>;
  failures: { email: string; error: string | null }[];
}
