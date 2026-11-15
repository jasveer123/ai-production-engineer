import type { Metadata } from "next"
import { IncidentDetailPage } from "@/features/incidents"

export const metadata: Metadata = { title: "Incident" }

export const instant = false

export default function Page() {
  return <IncidentDetailPage />
}
