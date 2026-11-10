import Link from "next/link"
import { BookOpen, Radar } from "lucide-react"
import { Badge, Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { COLLECTOR_COLLECTS } from "../catalog"
import { COLLECTOR } from "../constants"

interface CollectorCardProps {
  anchor: string
}

export function CollectorCard({ anchor }: CollectorCardProps) {
  return (
    <section
      aria-label="Recommended setup"
      className="grid gap-4 border border-brand/50 bg-brand-soft/40 p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center border border-line-strong bg-panel-2 text-brand">
          <Radar className="size-5" />
        </span>
        <h2 className="font-heading text-lg font-semibold">{COLLECTOR.NAME}</h2>
        <Badge variant="brand">Recommended</Badge>
      </div>
      <p className="text-sm leading-6">
        One collector reads the logs of everything already running. No code changes and no restarts.
      </p>
      <ul className="grid gap-1 text-[0.8125rem] text-muted-foreground">
        {COLLECTOR_COLLECTS.map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
      <Button
        className="w-fit"
        nativeButton={false}
        render={<Link href={ROUTES.collectorDocs(anchor)} target="_blank" />}
      >
        <BookOpen /> Set up the collector
      </Button>
    </section>
  )
}
