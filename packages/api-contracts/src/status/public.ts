import type { IsoTimestamp, Uuid } from '../common';
import type { PageBranding } from './page';
import type { MaintenanceView, ReportView } from './reports';
import type { ResourceState } from './structure';

export type OverallStatus = 'operational' | 'degraded' | 'outage' | 'maintenance' | 'unknown';

export interface StatusDay {
  date: string;
  uptime: number | null;
}

export interface PublicResource {
  id: Uuid;
  name: string;
  explanation: string | null;
  state: ResourceState;
  showHistory: boolean;
  uptime: number | null;
  days: StatusDay[];
}

export interface PublicSection {
  id: Uuid;
  name: string;
  resources: PublicResource[];
}

export interface PublicStatus extends PageBranding {
  slug: string;
  name: string;
  description: string | null;
  overall: OverallStatus;
  sections: PublicSection[];
  reports: ReportView[];
  maintenances: MaintenanceView[];
  generatedAt: IsoTimestamp;
}

export interface PublicHistory {
  slug: string;
  name: string;
  month: string;
  reports: ReportView[];
  maintenances: MaintenanceView[];
}

export interface PasswordRequired {
  name: string;
  passwordRequired: true;
}
