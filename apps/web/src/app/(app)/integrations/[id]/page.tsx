import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { INTEGRATIONS, IntegrationConnectPage } from "@/features/integrations"

export const instant = false

export function generateStaticParams() {
  return INTEGRATIONS.map((item) => ({ id: item.id }))
}

export async function generateMetadata({
  params,
}: PageProps<"/integrations/[id]">): Promise<Metadata> {
  const { id } = await params
  const definition = INTEGRATIONS.find((item) => item.id === id)
  return { title: definition?.name ?? "Integration" }
}

export default async function Page({ params }: PageProps<"/integrations/[id]">) {
  const { id } = await params
  const definition = INTEGRATIONS.find((item) => item.id === id)
  if (!definition) notFound()

  return <IntegrationConnectPage id={definition.id} />
}
