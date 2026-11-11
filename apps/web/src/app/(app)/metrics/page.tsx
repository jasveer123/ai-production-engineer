import type { Metadata } from "next"
import { MetricsPage } from "@/features/metrics"

export const metadata: Metadata = { title: "Metrics" }

export const instant = false

export default function Page() {
  return <MetricsPage />
}
