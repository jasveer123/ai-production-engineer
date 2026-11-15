import type { Metadata } from "next"
import { ErrorDetailPage } from "@/features/errors"

export const metadata: Metadata = { title: "Error" }

export const instant = false

export default function Page() {
  return <ErrorDetailPage />
}
