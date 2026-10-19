import { z } from 'zod';

/** Env schema for the NestJS control plane. Startup fails fast if any value is invalid. */
const booleanFlag = z.enum(['true', 'false']).transform((v) => v === 'true');

export const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    TEMPORAL_ADDRESS: z.string().min(1).default('localhost:7233'),
    TEMPORAL_NAMESPACE: z.string().min(1).default('default'),
    S3_ENDPOINT: z.string().url(),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(1).default('ape-artifacts'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
    OTEL_ENABLED: booleanFlag.default('true'),
    WEB_URL: z.string().url().default('http://localhost:3000'),
    // Signs session JWTs. Generate with `openssl rand -hex 32`.
    JWT_SECRET: z.string().min(32),
    SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
    GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
    GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
    // Local-only email login. Refused at startup when NODE_ENV=production.
    AUTH_DEV_LOGIN: booleanFlag.default('false'),
    // Public base URL of this API, used to show webhook URLs to users.
    PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
    // AES-256-GCM key for locally stored integration secrets: 64 hex chars (`openssl rand -hex 32`).
    SECRETS_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'must be 64 hex characters'),
    // Background ingestion processor and Jaeger poller. Tests turn these off and drive them directly.
    INGEST_WORKER_ENABLED: booleanFlag.default('true'),
    INGEST_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
    JAEGER_QUERY_URL: z.string().url().default('http://localhost:16686'),
    JAEGER_UI_URL: z.string().url().default('http://localhost:16686'),
    JAEGER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
    // GitHub App (ADR-009). The private key stays on disk; only its path is configured.
    GITHUB_APP_ID: z.string().regex(/^\d+$/).optional(),
    GITHUB_APP_PRIVATE_KEY_PATH: z.string().optional(),
    GITHUB_API_URL: z.string().url().default('https://api.github.com'),
    // Start an AI investigation automatically for every new incident (each run costs model tokens).
    AUTO_INVESTIGATE: booleanFlag.default('true'),
    GITHUB_HEALTH_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
    // Pull request status and checks sync. Localhost cannot receive GitHub webhooks, so the
    // poller is the primary path; the signed webhook (GITHUB_WEBHOOK_SECRET) only makes it faster.
    PR_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
    GITHUB_WEBHOOK_SECRET: z.string().min(16).optional(),
  })
  .refine((env) => !(env.NODE_ENV === 'production' && env.AUTH_DEV_LOGIN), {
    message: 'AUTH_DEV_LOGIN must be false in production',
    path: ['AUTH_DEV_LOGIN'],
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
