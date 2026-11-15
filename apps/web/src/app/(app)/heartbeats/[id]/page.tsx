import type { Metadata } from "next"
import { HeartbeatDetailPage } from "@/features/alerts"

export const metadata: Metadata = { title: "Heartbeat" }

export const instant = false

export default function Page() {
  return <HeartbeatDetailPage />
}
