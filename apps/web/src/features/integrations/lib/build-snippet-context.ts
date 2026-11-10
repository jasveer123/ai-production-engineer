import { SNIPPET_DEFAULTS } from "../constants"
import type { SnippetContext } from "../catalog/types"
import { toContainerUrl } from "./container-url"

interface SnippetContextInput {
  webUrl: string
  ingestUrl: string
  token: string | null
}

export function buildSnippetContext({
  webUrl,
  ingestUrl,
  token,
}: SnippetContextInput): SnippetContext {
  return {
    webUrl,
    ingestUrl,
    containerIngestUrl: toContainerUrl(ingestUrl),
    token: token ?? SNIPPET_DEFAULTS.TOKEN_PLACEHOLDER,
    service: SNIPPET_DEFAULTS.SERVICE,
    environment: SNIPPET_DEFAULTS.ENVIRONMENT,
  }
}
