import type { Metadata } from "next"
import { EscalationPage } from "@/features/escalation"

export const metadata: Metadata = { title: "Escalation" }

export const instant = false

export default function Page() {
  return <EscalationPage />
}
