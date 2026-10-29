import { z } from 'zod';
import { positiveInt, text, urlWithDefault } from './helpers';

export const serverEnv = {
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: positiveInt(4000),
  WEB_URL: urlWithDefault('http://localhost:3000'),
  PUBLIC_API_URL: urlWithDefault('http://localhost:4000'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  TEMPORAL_ADDRESS: text('localhost:7233'),
  TEMPORAL_NAMESPACE: text('default'),
};
