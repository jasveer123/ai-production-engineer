import type { Metadata } from "next"
import { StatusPageEditor } from "@/features/status"

export const metadata: Metadata = { title: "Status page" }

export const instant = false

export default function Page() {
  return <StatusPageEditor />
}
