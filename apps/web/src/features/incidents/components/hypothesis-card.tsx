"use client"

import { Badge, Button } from "@/components/ui"
import { cn } from "@/lib/utils"
import { CONFIDENCE_VARIANT, VERDICTS } from "../constants"
import { useHypothesisFeedback } from "../hooks"
import type { Hypothesis } from "../schemas"

interface HypothesisCardProps {
  workspaceId: string
  incidentId: string
  hypothesis: Hypothesis
  canAct: boolean
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null

  return (
    <div className="grid gap-1">
      <span className="font-mono text-[0.6875rem] tracking-[0.12em] text-muted-foreground uppercase">
        {title}
      </span>
      <ul className="grid gap-0.5 text-[0.8125rem] leading-5">
        {items.map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
    </div>
  )
}

export function HypothesisCard({
  workspaceId,
  incidentId,
  hypothesis,
  canAct,
}: HypothesisCardProps) {
  const feedback = useHypothesisFeedback(workspaceId, incidentId)
  const location = hypothesis.suspectedLocation

  return (
    <article
      className={cn(
        "grid gap-3 border p-4",
        hypothesis.rank === 1 ? "border-brand/60 bg-brand-soft/30" : "border-line"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={hypothesis.rank === 1 ? "brand" : "default"}>
          {hypothesis.rank === 1 ? "Most likely cause" : `Possible cause ${hypothesis.rank}`}
        </Badge>
        {hypothesis.confidence && (
          <Badge
            variant={
              CONFIDENCE_VARIANT[hypothesis.confidence as keyof typeof CONFIDENCE_VARIANT] ??
              "default"
            }
          >
            {hypothesis.confidence} confidence
          </Badge>
        )}
      </div>
      <p className="text-sm leading-6 font-medium">{hypothesis.summary}</p>
      {hypothesis.confidenceRationale && (
        <p className="text-[0.8125rem] leading-5 text-muted-foreground">
          {hypothesis.confidenceRationale}
        </p>
      )}
      {location && (
        <p className="font-mono text-[0.75rem] text-muted-foreground">
          {location.file}
          {location.line ? `:${location.line}` : ""}
          {location.symbol ? ` · ${location.symbol}` : ""}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Bullets title="Supports it" items={hypothesis.supportingEvidence} />
        <Bullets title="Argues against it" items={hypothesis.contradictingEvidence} />
      </div>
      <Bullets title="Still unknown" items={hypothesis.missingInformation} />
      {canAct && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-[0.8125rem] text-muted-foreground">Is this right?</span>
          {VERDICTS.map((verdict) => (
            <Button
              key={verdict.value}
              size="xs"
              variant={hypothesis.feedback.mine === verdict.value ? "default" : "outline"}
              disabled={feedback.isPending}
              onClick={() =>
                feedback.mutate({ hypothesisId: hypothesis.id, verdict: verdict.value })
              }
            >
              {verdict.label}
            </Button>
          ))}
        </div>
      )}
    </article>
  )
}
