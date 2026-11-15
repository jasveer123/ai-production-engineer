import { z } from 'zod';
import { nameSchema, uuidSchema, type Uuid } from '../common';
import { MAX_COMPONENTS } from './page';

export const RESOURCE_STATES = [
  'operational',
  'degraded',
  'downtime',
  'maintenance',
  'unknown',
] as const;
export type ResourceState = (typeof RESOURCE_STATES)[number];
export const MANUAL_STATES = ['operational', 'degraded', 'downtime', 'maintenance'] as const;
export type ManualState = (typeof MANUAL_STATES)[number];

export const resourceInputSchema = z.object({
  id: uuidSchema.optional(),
  publicName: nameSchema(80),
  explanation: z.string().trim().max(300).nullable().optional(),
  monitorIds: z.array(uuidSchema).max(10).default([]),
  manualState: z.enum(MANUAL_STATES).nullable().optional(),
  showHistory: z.boolean().default(true),
});

export const sectionInputSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().max(80).default(''),
  resources: z.array(resourceInputSchema).max(MAX_COMPONENTS),
});

export const structureSchema = z.object({
  sections: z.array(sectionInputSchema).max(20),
});
export type StructureInput = z.input<typeof structureSchema>;
export type StructureParsed = z.output<typeof structureSchema>;

export interface ResourceView {
  id: Uuid;
  publicName: string;
  explanation: string | null;
  monitorIds: Uuid[];
  manualState: ManualState | null;
  showHistory: boolean;
  state: ResourceState;
}

export interface SectionView {
  id: Uuid;
  name: string;
  resources: ResourceView[];
}

export interface StructureView {
  sections: SectionView[];
}
