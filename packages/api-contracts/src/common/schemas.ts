import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const isoDateTimeSchema = z.string().datetime();

export const nameSchema = (max: number, message?: string) =>
  z.string().trim().min(1, message).max(max);
export const optionalText = (max: number) => z.string().trim().max(max).optional();

export const secretSchema = nameSchema(4000);
export const urlSchema = z.string().trim().url();
export const boundedUrlSchema = urlSchema.max(500);

export const REPO_FULL_NAME_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export const repoFullNameSchema = z
  .string()
  .regex(REPO_FULL_NAME_PATTERN, 'Use the form owner/repo');

export const coercedInt = (max: number, fallback: number) =>
  z.coerce.number().int().min(1).max(max).default(fallback);

export const pagedQuery = (max: number, fallback: number) =>
  z.object({ before: isoDateTimeSchema.optional(), limit: coercedInt(max, fallback) });
