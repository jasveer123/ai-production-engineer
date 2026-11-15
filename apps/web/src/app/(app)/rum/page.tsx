import type { Metadata } from "next"
import { RumPage } from "@/features/rum"

export const metadata: Metadata = { title: "Real users" }

export const instant = false

export default function Page() {
  return <RumPage />
}
