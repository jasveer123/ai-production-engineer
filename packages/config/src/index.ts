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
