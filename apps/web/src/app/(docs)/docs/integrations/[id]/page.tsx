import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { INTEGRATIONS, IntegrationDocsPage } from "@/features/integrations"

export const instant = false

export function generateStaticParams() {
  return INTEGRATIONS.map((item) => ({ id: item.id }))
}

export const metadata: Metadata = { title: "Integration guide" }

export default async function Page({ params }: PageProps<"/docs/integrations/[id]">) {
  const { id } = await params
  const definition = INTEGRATIONS.find((item) => item.id === id)
  if (!definition) notFound()

  return <IntegrationDocsPage id={definition.id} />
}
