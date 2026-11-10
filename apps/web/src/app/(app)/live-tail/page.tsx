import type { Metadata } from "next"
import { LiveTailPage } from "@/features/telemetry"

export const metadata: Metadata = { title: "Live tail" }

export const instant = false

export default function Page() {
  return <LiveTailPage />
}
