import type { SnippetContext } from "../types"

export function apeEnv(context: SnippetContext): string {
  return [
    `export APE_TOKEN="${context.token}"`,
    `export APE_ENDPOINT="${context.ingestUrl}"`,
    `export APE_SERVICE="${context.service}"`,
    `export APE_ENVIRONMENT="${context.environment}"`,
  ].join("\n")
}
