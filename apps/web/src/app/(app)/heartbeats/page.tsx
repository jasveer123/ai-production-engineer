import type { Metadata } from "next"
import { HeartbeatsPage } from "@/features/alerts"

export const metadata: Metadata = { title: "Heartbeats" }

export const instant = false

export default function Page() {
  return <HeartbeatsPage />
}
