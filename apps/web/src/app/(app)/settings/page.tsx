import type { Metadata } from "next"
import { SettingsPage } from "@/features/settings"

export const metadata: Metadata = { title: "Settings" }

export const instant = false

export default function Page() {
  return <SettingsPage />
}
