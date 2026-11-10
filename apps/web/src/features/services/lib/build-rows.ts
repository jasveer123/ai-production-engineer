import { QUIET_AFTER_MS } from "../constants"
import type {
  BusinessImpact,
  RegisteredService,
  ServiceLogSummary,
  ServiceSummary,
} from "../schemas"

export type ServiceStatus = "receiving" | "quiet" | "problem"

export interface ServiceRowData {
  key: string
  name: string
  environment: string
  status: ServiceStatus
  total: number
  errors: number
  lastAt: string
  buckets: number[]
  problems: string[]
  serviceId: string | null
  valuePerRequest: number | null
  currency: string | null
  impact: number | null
}

interface BuildInput {
  summary: ServiceSummary | undefined
  incidents: { serviceName: string | null; title: string }[]
  registered: RegisteredService[] | undefined
  impact: BusinessImpact | undefined
  now?: number
}

const keyOf = (name: string, environment: string) => `${name}\u0000${environment}`

export function buildServiceRows({
  summary,
  incidents,
  registered,
  impact,
  now = Date.now(),
}: BuildInput): ServiceRowData[] {
  const ids = new Map(
    (registered ?? []).map((item) => [keyOf(item.name, item.environment), item.id])
  )
  const impacts = new Map(
    (impact?.services ?? []).map((item) => [keyOf(item.serviceName, item.environment), item])
  )

  return (summary?.services ?? []).map((item: ServiceLogSummary) => {
    const key = keyOf(item.service, item.environment)
    const problems = incidents
      .filter((incident) => incident.serviceName === item.service)
      .map((incident) => incident.title)
    const quiet = now - new Date(item.lastAt).getTime() > QUIET_AFTER_MS
    const found = impacts.get(key)

    return {
      key,
      name: item.service,
      environment: item.environment,
      status: problems.length > 0 ? "problem" : quiet ? "quiet" : "receiving",
      total: item.total,
      errors: item.errors,
      lastAt: item.lastAt,
      buckets: item.buckets,
      problems,
      serviceId: ids.get(key) ?? null,
      valuePerRequest: found?.valuePerRequest ?? null,
      currency: found?.currency ?? null,
      impact: found?.impact ?? null,
    }
  })
}
