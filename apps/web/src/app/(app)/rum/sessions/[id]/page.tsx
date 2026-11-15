import type { Metadata } from "next"
import { RumSessionPage } from "@/features/rum"

export const metadata: Metadata = { title: "Session" }

export const instant = false

export default function Page() {
  return <RumSessionPage />
}
