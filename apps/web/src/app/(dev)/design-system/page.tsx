import type { Metadata } from "next"
import { ComponentsShowcase } from "@/features/design-system"

export const metadata: Metadata = { title: "Design system" }

export default function DesignSystemPage() {
  return <ComponentsShowcase />
}
