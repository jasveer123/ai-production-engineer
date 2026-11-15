"use client"

import * as React from "react"
import { Chip, Eyebrow, Spinner } from "@/components/ui"
import { MAP_RANGES } from "../constants"
import { useServiceMap } from "../hooks"
import { ServiceMapDiagram } from "./service-map-diagram"
import { ServiceRedTable } from "./service-red-table"

interface ServiceMapSectionProps {
  workspaceId: string
}

export function ServiceMapSection({ workspaceId }: ServiceMapSectionProps) {
  const [range, setRange] = React.useState<string>("1h")
  const { data, isPending } = useServiceMap(workspaceId, range)

  return (
    <section className="grid gap-4" aria-labelledby="map-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="map-title" className="font-heading text-base font-semibold">
          Service map from traces
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>Window</Eyebrow>
          {MAP_RANGES.map((item) => (
            <Chip key={item.id} selected={range === item.id} onClick={() => setRange(item.id)}>
              {item.label}
            </Chip>
          ))}
        </div>
      </div>
      {isPending || !data ? (
        <Spinner />
      ) : data.services.length === 0 ? (
        <p className="border border-dashed border-line p-6 text-[0.8125rem] text-muted-foreground">
          No spans in this window. Send traces with OpenTelemetry to see request rate, errors,
          latency and how services call each other.
        </p>
      ) : (
        <>
          <p className="text-[0.75rem] text-muted-foreground">
            Arrows are calls seen between services in this window. Dashed arrows are inferred from
            parent and child spans without client or server span kinds.
          </p>
          <ServiceMapDiagram map={data} />
          <ServiceRedTable services={data.services} />
        </>
      )}
    </section>
  )
}
