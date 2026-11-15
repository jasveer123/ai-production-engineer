import { z } from 'zod';
import { nameSchema, uuidSchema, type IsoTimestamp, type Uuid } from '../common';

export const MAX_COMPONENTS = 30;
export const HISTORY_DAYS = 90;
export const PAGE_THEMES = ['system', 'light', 'dark'] as const;
export const HEADER_LAYOUTS = ['logo_and_name', 'logo_only', 'name_only'] as const;
export type PageTheme = (typeof PAGE_THEMES)[number];
export type HeaderLayout = (typeof HEADER_LAYOUTS)[number];

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single dashes');

export const webUrlSchema = z
  .string()
  .trim()
  .max(500)
  .url()
  .regex(/^https?:\/\//i, 'Use an http or https address');

export const createStatusPageSchema = z.object({
  name: nameSchema(80),
  slug: slugSchema,
  description: z.string().trim().max(300).optional(),
  monitorIds: z.array(uuidSchema).max(MAX_COMPONENTS).default([]),
});
export type CreateStatusPageInput = z.input<typeof createStatusPageSchema>;

export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
    'Enter a domain like status.example.com',
  );

export const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
export type SubscribeInput = z.infer<typeof subscribeSchema>;

export const updateStatusPageSchema = z.object({
  name: nameSchema(80).optional(),
  slug: slugSchema.optional(),
  description: z.string().trim().max(300).nullable().optional(),
  monitorIds: z.array(uuidSchema).max(MAX_COMPONENTS).optional(),
  customDomain: domainSchema.nullable().optional(),
  logoUrl: webUrlSchema.nullable().optional(),
  logoDarkUrl: webUrlSchema.nullable().optional(),
  homepageUrl: webUrlSchema.nullable().optional(),
  contactUrl: webUrlSchema.nullable().optional(),
  theme: z.enum(PAGE_THEMES).optional(),
  headerLayout: z.enum(HEADER_LAYOUTS).optional(),
  password: z.string().min(8).max(200).nullable().optional(),
  hideFromSearch: z.boolean().optional(),
});
export type UpdateStatusPageInput = z.infer<typeof updateStatusPageSchema>;

export const pageAccessSchema = z.object({ password: z.string().min(1).max(200) });
export type PageAccessInput = z.infer<typeof pageAccessSchema>;

export interface PageBranding {
  logoUrl: string | null;
  logoDarkUrl: string | null;
  homepageUrl: string | null;
  contactUrl: string | null;
  theme: PageTheme;
  headerLayout: HeaderLayout;
  hideFromSearch: boolean;
}

export interface StatusPageView extends PageBranding {
  id: Uuid;
  name: string;
  slug: string;
  description: string | null;
  monitorIds: Uuid[];
  customDomain: string | null;
  domainToken: string | null;
  domainVerified: boolean;
  cnameTarget: string;
  isPrivate: boolean;
  subscribers: number;
  openReports: number;
  createdAt: IsoTimestamp;
}
