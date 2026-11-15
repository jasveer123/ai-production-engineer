import { Badge } from "@/components/ui"
import { STATUS_LABEL, STATUS_VARIANT } from "../constants"

interface IncidentStatusBadgeProps {
  status: string
}

export function IncidentStatusBadge({ status }: IncidentStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "default"}>{STATUS_LABEL[status] ?? status}</Badge>
  )
}
