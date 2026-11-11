import type { Metadata } from "next"
import { ErrorsPage } from "@/features/errors"

export const metadata: Metadata = { title: "Errors" }

export const instant = false

export default function Page() {
  return <ErrorsPage />
}
