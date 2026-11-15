"use client"

import { Spinner } from "@/components/ui"
import { formatDateTime } from "@/lib/format/relative-time"
import { COVERAGE_DAYS } from "../constants"
import { useCoverage } from "../hooks"
import type { Person } from "../schemas"
import { TimelineStrip } from "./timeline-strip"

interface CoveragePreviewProps {
  workspaceId: string
  scheduleId: string
  participants: Person[]
}

export function CoveragePreview({ workspaceId, scheduleId, participants }: CoveragePreviewProps) {
  const coverage = useCoverage(workspaceId, scheduleId, COVERAGE_DAYS)
  if (coverage.isPending) return <Spinner />
  if (!coverage.data) return null
  const { intervals, gaps } = coverage.data
  const uncoveredHours = Math.round(
    gaps.reduce(
      (sum, g) => sum + new Date(g.endsAt).getTime() - new Date(g.startsAt).getTime(),
      0
    ) / 3_600_000
  )

  return (
    <div className="grid gap-2">
      <TimelineStrip
        shifts={intervals.map((i) => ({ ...i, override: i.source === "override" }))}
        gaps={gaps}
        participants={participants}
        label={`Who is on call over the next ${COVERAGE_DAYS} days`}
      />
      {gaps.length > 0 && (
        <p
          role="alert"
          className="border border-danger/40 bg-danger/10 p-3 text-[0.8125rem] text-danger"
        >
          Nobody is on call for {uncoveredHours} hour{uncoveredHours === 1 ? "" : "s"} in the next{" "}
          {COVERAGE_DAYS} days. First gap: {formatDateTime(gaps[0]!.startsAt)} to{" "}
          {formatDateTime(gaps[0]!.endsAt)}.
        </p>
      )}
    </div>
  )
}
