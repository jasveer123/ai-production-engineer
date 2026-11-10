import type { Metadata } from "next"
import { CollectorDocsPage } from "@/features/integrations"

export const metadata: Metadata = { title: "Pramaan collector" }

export default function Page() {
  return <CollectorDocsPage />
}
