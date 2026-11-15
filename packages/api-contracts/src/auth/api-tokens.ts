import { z } from 'zod';
import { nameSchema, uuidSchema, type IsoTimestamp, type Uuid } from '../common';

export const API_TOKEN_PREFIX = 'ape_pat_';

export const API_TOKEN_SCOPES = ['read', 'write', 'ingest'] as const;
export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];
export const API_TOKEN_AREAS = [
  'monitors',
  'alerts',
  'incidents',
  'oncall',
  'status-pages',
] as const;
export type ApiTokenArea = (typeof API_TOKEN_AREAS)[number];

export const createApiTokenSchema = z.object({
  name: nameSchema(80),
  workspaceId: uuidSchema,
  scopes: z.array(z.enum(API_TOKEN_SCOPES)).min(1).max(3).default(['read']),
  areas: z.array(z.enum(API_TOKEN_AREAS)).max(5).default([]),
  expiresInDays: z.number().int().min(1).max(365).nullable().default(90),
});
export type CreateApiTokenInput = z.input<typeof createApiTokenSchema>;

export interface ApiTokenView {
  id: Uuid;
  name: string;
  prefix: string;
  workspaceId: Uuid | null;
  scopes: ApiTokenScope[];
  areas: ApiTokenArea[];
  expiresAt: IsoTimestamp | null;
  lastUsedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
}

export interface ApiTokenWithSecret extends ApiTokenView {
  token: string;
}
