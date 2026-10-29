import { z } from 'zod';

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const DAY = 24 * 60 * MINUTE;

export const booleanFlag = z.enum(['true', 'false']).transform((v) => v === 'true');

export const text = (fallback: string) => z.string().min(1).default(fallback);
export const urlWithDefault = (fallback: string) => z.string().url().default(fallback);

export const positiveInt = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);
export const nonNegativeInt = (fallback: number) =>
  z.coerce.number().int().nonnegative().default(fallback);
export const boundedInt = (min: number, max: number, fallback: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

export const optionalText = z.string().optional();
export const optionalUrl = z.string().url().optional();
