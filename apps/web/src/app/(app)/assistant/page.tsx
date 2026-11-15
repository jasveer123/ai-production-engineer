import type { Metadata } from "next"
import { AssistantPage } from "@/features/assistant"

export const metadata: Metadata = { title: "Ask AI" }

export const instant = false

export default function Page() {
  return <AssistantPage />
}
