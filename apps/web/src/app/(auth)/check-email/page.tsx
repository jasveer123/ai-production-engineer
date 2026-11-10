import type { Metadata } from "next"
import { CheckEmailNotice } from "@/features/auth"

export const metadata: Metadata = { title: "Check your email" }

export default function CheckEmailPage() {
  return <CheckEmailNotice />
}
