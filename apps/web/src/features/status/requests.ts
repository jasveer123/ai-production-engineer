export interface PageRequest {
  name: string
  slug: string
  description?: string
  monitorIds: string[]
}

export interface SettingsRequest {
  name?: string
  slug?: string
  description?: string | null
  customDomain?: string | null
  logoUrl?: string | null
  logoDarkUrl?: string | null
  homepageUrl?: string | null
  contactUrl?: string | null
  theme?: string
  headerLayout?: string
  password?: string | null
  hideFromSearch?: boolean
}

export interface ResourceDraft {
  key: string
  id?: string
  publicName: string
  explanation: string
  monitorIds: string[]
  manualState: string
  showHistory: boolean
}

export interface SectionDraft {
  key: string
  id?: string
  name: string
  resources: ResourceDraft[]
}

export interface AffectedDraft {
  resourceId: string
  impact: string
}

export interface ReportRequest {
  title: string
  body: string
  state: string
  affected: AffectedDraft[]
  publishedAt?: string
  notifySubscribers: boolean
}

export interface ReportUpdateRequest {
  body: string
  state: string
  affected?: AffectedDraft[]
  notifySubscribers: boolean
}

export interface MaintenanceRequest {
  title: string
  description: string
  startsAt: string
  endsAt: string
  timezone: string
  resourceIds: string[]
  notifySubscribers: boolean
}
