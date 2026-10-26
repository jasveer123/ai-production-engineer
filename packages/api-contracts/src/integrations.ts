import { z } from 'zod';

export const INTEGRATION_PROVIDERS = ['deploy_webhook', 'otel_jaeger', 'github'] as const;
export const integrationProviderSchema = z.enum(INTEGRATION_PROVIDERS);
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;

export const createIntegrationSchema = z.object({
  provider: integrationProviderSchema,
  name: z.string().trim().min(1).max(80),
});
export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;

export interface Integration {
  id: string;
  provider: string;
  name: string;
  status: 'pending' | 'connected' | 'error' | 'disconnected';
  /** What the platform is allowed to do with this integration. */
  scope: string;
  lastSyncAt: string | null;
  lastError: string | null;
  webhookUrl: string | null;
  createdAt: string;
}

/** Returned once on creation or secret rotation. The secret is never shown again. */
export interface IntegrationWithSecret extends Integration {
  signingSecret: string | null;
}

export interface DeadLetter {
  id: string;
  integrationId: string;
  source: string;
  externalEventId: string;
  attempts: number;
  deadReason: string | null;
  lastError: string | null;
  receivedAt: string;
}
