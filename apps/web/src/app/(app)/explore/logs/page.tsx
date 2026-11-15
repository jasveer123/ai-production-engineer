import type { Metadata } from "next"
import { LogsExplorerPage } from "@/features/telemetry"

export const metadata: Metadata = { title: "Explore logs" }

export const instant = false

export default function Page() {
  return <LogsExplorerPage />
}
