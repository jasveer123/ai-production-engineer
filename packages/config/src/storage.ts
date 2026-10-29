import { z } from 'zod';
import { optionalUrl, text } from './helpers';

export const storageEnv = {
  S3_ENDPOINT: optionalUrl,
  S3_ACCESS_KEY: z.string().min(1).optional(),
  S3_SECRET_KEY: z.string().min(1).optional(),
  S3_REGION: text('us-east-1'),
  S3_BUCKET: text('ape-artifacts'),
};
