import type { Metadata } from "next"
import { MonitorFormPage } from "@/features/monitors"

export const metadata: Metadata = { title: "Edit monitor" }

export const instant = false

export default function Page() {
  return <MonitorFormPage />
}
