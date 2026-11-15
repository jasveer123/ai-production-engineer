import { CodeBlock } from "@/components/ui"
import { formatDateTime } from "@/lib/format/relative-time"
import type { CapturedResponse as CapturedResponseData } from "../response-schemas"

interface CapturedResponseProps {
  response: CapturedResponseData
}

export function CapturedResponse({ response }: CapturedResponseProps) {
  const headers = Object.entries(response.headers ?? {})
  return (
    <div className="grid gap-2">
      <p className="font-mono text-[0.75rem] text-muted-foreground">
        {formatDateTime(response.checkedAt)}
        {response.region ? ` · ${response.region}` : ""}
        {response.statusCode !== null ? ` · HTTP ${response.statusCode}` : ""}
        {response.error ? ` · ${response.error}` : ""}
      </p>
      {headers.length > 0 && (
        <CodeBlock>{headers.map(([name, value]) => `${name}: ${value}`).join("\n")}</CodeBlock>
      )}
      {response.bodyPreview ? (
        <CodeBlock className="max-h-60">{response.bodyPreview}</CodeBlock>
      ) : (
        <p className="text-[0.8125rem] text-muted-foreground">
          The response body was not captured for this check.
        </p>
      )}
    </div>
  )
}
