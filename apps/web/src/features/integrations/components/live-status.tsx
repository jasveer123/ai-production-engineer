"use client"

import { Status } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { useUsage } from "../hooks"
import { formatRate, summarizeUsage } from "../lib"

export function LiveStatus() {
  const { workspace } = useCurrentWorkspace()
  const { data } = useUsage(workspace?.id, true)
  const perMinute = data ? summarizeUsage(data.histogram).perMinute : 0

  return (
    <Status state={perMinute > 0 ? "live" : "idle"}>
      {perMinute > 0 ? `Receiving · ${formatRate(perMinute)} logs/min` : "Waiting for data"}
    </Status>
  )
}
