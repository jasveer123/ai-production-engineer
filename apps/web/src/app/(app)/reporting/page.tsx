import type { Metadata } from "next"
import { ReportingPage } from "@/features/reporting"

export const metadata: Metadata = { title: "Reporting" }

export const instant = false

export default function Page() {
  return <ReportingPage />
}
