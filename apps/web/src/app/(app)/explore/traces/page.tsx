import type { Metadata } from "next"
import { TracesExplorerPage } from "@/features/telemetry"

export const metadata: Metadata = { title: "Explore traces" }

export const instant = false

export default function Page() {
  return <TracesExplorerPage />
}
