import { Badge } from "@/components/ui"
import { RESPONSE_LABEL, RESPONSE_VARIANT } from "../constants"

interface ResponseStateBadgeProps {
  state: string
}

export function ResponseStateBadge({ state }: ResponseStateBadgeProps) {
  return (
    <Badge variant={RESPONSE_VARIANT[state as keyof typeof RESPONSE_VARIANT] ?? "default"}>
      {RESPONSE_LABEL[state] ?? state}
    </Badge>
  )
}
