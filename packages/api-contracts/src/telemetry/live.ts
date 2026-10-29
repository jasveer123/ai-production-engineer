import type { Uuid } from '../common';

export interface LiveChange {
  table: string;
  incidentId: Uuid | null;
}
