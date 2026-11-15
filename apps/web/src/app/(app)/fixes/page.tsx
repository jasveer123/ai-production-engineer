import type { Metadata } from "next"
import { FixesPage } from "@/features/incidents"

export const metadata: Metadata = { title: "Fixes" }

export const instant = false

export default function Page() {
  return <FixesPage />
}
