import { Badge } from "@/components/ui"
import { DELIVERY_STATES } from "../constants"

interface DeliveryStateBadgeProps {
  state: string
}

export function DeliveryStateBadge({ state }: DeliveryStateBadgeProps) {
  const known = DELIVERY_STATES.find((item) => item.value === state)
  return <Badge variant={known?.tone ?? "default"}>{known?.label ?? state}</Badge>
}
