import { Badge } from "@/components/ui"
import { SEVERITY_VARIANT, type SeverityValue } from "../constants"

interface SeverityBadgeProps {
  severity: string
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <Badge variant={SEVERITY_VARIANT[severity as SeverityValue] ?? "default"}>{severity}</Badge>
  )
}
