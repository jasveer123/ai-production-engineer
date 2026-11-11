import { z } from 'zod';
import { nameSchema, type IsoTimestamp, type Uuid } from '../common';

export const API_TOKEN_PREFIX = 'ape_pat_';

export const createApiTokenSchema = z.object({
  name: nameSchema(80),
  expiresInDays: z.number().int().min(1).max(365).nullable().default(90),
});
export type CreateApiTokenInput = z.input<typeof createApiTokenSchema>;

export interface ApiTokenView {
  id: Uuid;
  name: string;
  prefix: string;
  expiresAt: IsoTimestamp | null;
  lastUsedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
}

export interface ApiTokenWithSecret extends ApiTokenView {
  token: string;
}
