import { Eyebrow } from "@/components/ui"
import type { IntegrationFacts } from "../catalog"

interface FactsListProps {
  facts: IntegrationFacts
}

export function FactsList({ facts }: FactsListProps) {
  return (
    <dl className="grid gap-3 text-[0.8125rem] leading-5">
      <div className="grid gap-1">
        <dt>
          <Eyebrow>Access it needs</Eyebrow>
        </dt>
        <dd>{facts.access}</dd>
      </div>
      <div className="grid gap-1">
        <dt>
          <Eyebrow>Limits and cost</Eyebrow>
        </dt>
        <dd>{facts.limits}</dd>
      </div>
    </dl>
  )
}
