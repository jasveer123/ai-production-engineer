import type { Metadata } from "next"
import { StatusPagesPage } from "@/features/status"

export const metadata: Metadata = { title: "Status pages" }

export const instant = false

export default function Page() {
  return <StatusPagesPage />
}
