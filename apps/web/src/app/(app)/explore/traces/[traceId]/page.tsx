import type { Metadata } from "next"
import { TraceDetailPage } from "@/features/telemetry"

export const metadata: Metadata = { title: "Trace" }

export const instant = false

interface PageProps {
  params: Promise<{ traceId: string }>
}

export default async function Page({ params }: PageProps) {
  const { traceId } = await params
  return <TraceDetailPage traceId={decodeURIComponent(traceId)} />
}
