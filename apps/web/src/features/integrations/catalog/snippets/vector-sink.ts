import { INGEST_ENDPOINTS } from "@/lib/api/endpoints"
import type { SnippetContext } from "../types"

interface VectorSinkOptions {
  input: string
  query: string
  indent?: number
  tokenValue?: string
}

export function vectorSink(context: SnippetContext, options: VectorSinkOptions): string[] {
  const pad = " ".repeat(options.indent ?? 0)
  const token = options.tokenValue ?? context.token

  return [
    "sinks:",
    "  pramaan:",
    "    type: http",
    "    inputs:",
    `      - ${options.input}`,
    `    uri: ${context.containerIngestUrl}${INGEST_ENDPOINTS.SEND_LOGS}?${options.query}`,
    "    encoding:",
    "      codec: json",
    "    auth:",
    "      strategy: bearer",
    `      token: ${token}`,
  ].map((line) => `${pad}${line}`)
}
