import type { Metadata } from "next"
import { OncallPage } from "@/features/oncall"

export const metadata: Metadata = { title: "Who's on call" }

export const instant = false

export default function Page() {
  return <OncallPage />
}
