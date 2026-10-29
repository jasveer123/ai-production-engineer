import { z } from 'zod';
import { authEnv } from './auth';
import { githubEnv } from './github';
import { providersEnv } from './providers';
import { serverEnv } from './server';
import { storageEnv } from './storage';
import { telemetryEnv } from './telemetry';
import { workflowsEnv } from './workflows';

export const apiEnvSchema = z
  .object({
    ...serverEnv,
    ...storageEnv,
    ...authEnv,
    ...telemetryEnv,
    ...providersEnv,
    ...githubEnv,
    ...workflowsEnv,
  })
  .refine((env) => !(env.NODE_ENV === 'production' && env.AUTH_DEV_LOGIN), {
    message: 'AUTH_DEV_LOGIN must be false in production',
    path: ['AUTH_DEV_LOGIN'],
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;
