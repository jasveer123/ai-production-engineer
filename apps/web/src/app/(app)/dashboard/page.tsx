import type { Metadata } from "next"
import { DashboardPage } from "@/features/dashboard"

export const metadata: Metadata = { title: "Dashboard" }

export const instant = false

export default function Page() {
  return <DashboardPage />
}
