import type { Metadata } from "next"
import { IncidentsPage } from "@/features/incidents"

export const metadata: Metadata = { title: "Incidents" }

export const instant = false

export default function Page() {
  return <IncidentsPage />
}
