import { z } from 'zod';
import {
  nameSchema,
  type ConnectionStatus,
  type IsoTimestamp,
  type Uuid,
  type WithSecret,
} from '../common';

export const INTEGRATION_PROVIDERS = ['deploy_webhook', 'otel_jaeger', 'github'] as const;
export const integrationProviderSchema = z.enum(INTEGRATION_PROVIDERS);
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;

export const createIntegrationSchema = z.object({
  provider: integrationProviderSchema,
  name: nameSchema(80),
});
export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;

export interface Integration {
  id: Uuid;
  provider: string;
  name: string;
  status: ConnectionStatus;
  scope: string;
  lastSyncAt: IsoTimestamp | null;
  lastError: string | null;
  webhookUrl: string | null;
  createdAt: IsoTimestamp;
}

export type IntegrationWithSecret = WithSecret<Integration, 'signingSecret', string | null>;

export interface DeadLetter {
  id: Uuid;
  integrationId: Uuid;
  source: string;
  externalEventId: string;
  attempts: number;
  deadReason: string | null;
  lastError: string | null;
  receivedAt: IsoTimestamp;
}
