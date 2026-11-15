import type { Metadata } from "next"
import { MonitorsPage } from "@/features/monitors"

export const metadata: Metadata = { title: "Monitors" }

export const instant = false

export default function Page() {
  return <MonitorsPage />
}
