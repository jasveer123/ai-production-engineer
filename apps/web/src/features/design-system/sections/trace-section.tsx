import { Box, Copy, Hexagon, Zap } from "lucide-react"
import { Trace, TraceItem } from "@/components/ui"
import { Section } from "../components"

export function TraceSection() {
  return (
    <Section
      id="trace"
      title="Trace timeline"
      note="Used for the AI's reasoning and incident events. Time and connector take the color of the event."
    >
      <Trace className="max-w-xl">
        <TraceItem
          time="13:05"
          tone="ai"
          active
          icon={<Box />}
          action={<Copy className="size-4 text-muted-foreground" />}
        >
          Received task: Exec Report Draft
        </TraceItem>
        <TraceItem time="13:06" icon={<Hexagon />}>
          Parsed input: dates, location, guests
        </TraceItem>
        <TraceItem time="13:06" tone="danger" icon={<Zap />}>
          Error in parsing list of deliverables
        </TraceItem>
        <TraceItem time="13:10" icon={<Hexagon />}>
          Filtered results: price, rating, amenities
        </TraceItem>
        <TraceItem time="13:19" icon={<Hexagon />}>
          Generated output: booking options
        </TraceItem>
      </Trace>
    </Section>
  )
}
