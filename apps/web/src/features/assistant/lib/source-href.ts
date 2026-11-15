import { ROUTES } from "@/lib/constants/routes"
import type { ChatSource } from "../schemas"

export function sourceHref(source: ChatSource): string | null {
  if (!source.id) return null
  if (source.kind === "incident") return ROUTES.incidentDetail(source.id)
  if (source.kind === "error") return ROUTES.errorDetail(source.id)
  if (source.kind === "monitor") return ROUTES.monitorDetail(source.id)
  if (source.kind === "log_alert") return ROUTES.alerts
  return null
}
