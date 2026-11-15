import type { Metadata } from "next"
import { MonitorDetailPage } from "@/features/monitors"

export const metadata: Metadata = { title: "Monitor" }

export const instant = false

export default function Page() {
  return <MonitorDetailPage />
}
