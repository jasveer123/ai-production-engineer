import Link from "next/link"
import { Filter, ListTree, Rows3 } from "lucide-react"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import type { LogLine } from "../schemas"

interface ExploreLogActionsProps {
  line: LogLine
  onContext: (line: LogLine) => void
  onFilter: (term: string) => void
}

export function ExploreLogActions({ line, onContext, onFilter }: ExploreLogActionsProps) {
  return (
    <>
      <Button variant="outline" size="xs" onClick={() => onContext(line)}>
        <Rows3 /> Show surrounding lines
      </Button>
      {line.traceId && (
        <Button
          variant="outline"
          size="xs"
          nativeButton={false}
          render={<Link href={ROUTES.traceDetail(line.traceId)} />}
        >
          <ListTree /> Open trace
        </Button>
      )}
      <Button variant="ghost" size="xs" onClick={() => onFilter(`service:${line.service}`)}>
        <Filter /> Only {line.service}
      </Button>
    </>
  )
}
