import Link from "next/link"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import type { IntegrationDefinition } from "../catalog"
import type { IngestOverview } from "../schemas"
import { StatusCard } from "./status-card"

const SHOWN_QUIET = 3

interface StatusCardsProps {
  definitions: IntegrationDefinition[]
  overview: IngestOverview | undefined
}

export function StatusCards({ definitions, overview }: StatusCardsProps) {
  const waiting = definitions.filter(
    (item) =>
      (overview?.ways.find((way) => way.way === item.way)?.state ?? "not_set_up") === "not_set_up"
  )
  const silent = (overview?.streams ?? []).filter((stream) => stream.state === "silent")
  const first = waiting[0]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <StatusCard
        tag="Waiting"
        tone="warn"
        title={
          waiting.length === 0
            ? "Nothing is waiting"
            : `${waiting.length} integration${waiting.length === 1 ? "" : "s"} waiting for data`
        }
        note={
          waiting.length === 0
            ? "Every way of sending logs has delivered something."
            : waiting.map((item) => item.name).join(", ")
        }
        action={
          first && (
            <Button
              variant="ghost"
              size="sm"
              className="text-brand"
              nativeButton={false}
              render={<Link href={ROUTES.integrationDetail(first.id)} />}
            >
              Set up {first.name}
            </Button>
          )
        }
      />
      <StatusCard
        tag="Quiet"
        tone="danger"
        title={
          silent.length === 0
            ? "Nothing has gone quiet"
            : `${silent.length} source${silent.length === 1 ? "" : "s"} stopped sending`
        }
        note={
          silent.length === 0
            ? "A source is quiet when it sends nothing for 15 minutes."
            : `${silent
                .slice(0, SHOWN_QUIET)
                .map(
                  (stream) => `${stream.serviceName} (${formatRelativeTime(stream.lastReceivedAt)})`
                )
                .join(
                  ", "
                )}${silent.length > SHOWN_QUIET ? ` and ${silent.length - SHOWN_QUIET} more` : ""}`
        }
      />
    </div>
  )
}
