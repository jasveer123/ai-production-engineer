import type { Metadata } from "next"
import { MonitorFormPage } from "@/features/monitors"

export const metadata: Metadata = { title: "Create monitor" }

export const instant = false

export default function Page() {
  return <MonitorFormPage />
}
