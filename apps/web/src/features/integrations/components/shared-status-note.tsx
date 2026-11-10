import { Info } from "lucide-react"
import type { IntegrationDefinition } from "../catalog"
import { getStatusGroups } from "../lib"

interface SharedStatusNoteProps {
  definitions: IntegrationDefinition[]
}

export function SharedStatusNote({ definitions }: SharedStatusNoteProps) {
  const groups = getStatusGroups(definitions)
  if (groups.length === 0) return null

  return (
    <p className="flex items-start gap-2 text-[0.8125rem] leading-5 text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <span>
        Cards that send data the same way share one status:{" "}
        {groups.map((group) => group.map((item) => item.name).join(", ")).join(" · ")}. A shared
        status turns green when any of them sends data.
      </span>
    </p>
  )
}
