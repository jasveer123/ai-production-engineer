import { Badge } from "@/components/ui"
import { STATE_LABEL } from "../constants"
import type { StreamState } from "../schemas"

const STATE_VARIANT = {
  receiving: "success",
  silent: "warning",
  not_set_up: "default",
} as const

interface StateBadgeProps {
  state: StreamState
}

export function StateBadge({ state }: StateBadgeProps) {
  return <Badge variant={STATE_VARIANT[state]}>{STATE_LABEL[state]}</Badge>
}
