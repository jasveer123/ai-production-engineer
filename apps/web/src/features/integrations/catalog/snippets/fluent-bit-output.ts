import { INGEST_ENDPOINTS } from "@/lib/api/endpoints"
import type { SnippetContext } from "../types"

const DEFAULT_PORT = "80"

interface FluentBitOutputOptions {
  query: string
  tokenValue?: string
}

export function fluentBitOutput(
  context: SnippetContext,
  options: FluentBitOutputOptions
): string[] {
  const url = new URL(context.containerIngestUrl)
  const token = options.tokenValue ?? context.token

  return [
    "[OUTPUT]",
    "    Name   http",
    "    Match  *",
    `    Host   ${url.hostname}`,
    `    Port   ${url.port || DEFAULT_PORT}`,
    `    URI    ${INGEST_ENDPOINTS.SEND_LOGS}?${options.query}`,
    "    Format json",
    "    Json_date_key timestamp",
    "    Json_date_format iso8601",
    `    Header Authorization Bearer ${token}`,
  ]
}
