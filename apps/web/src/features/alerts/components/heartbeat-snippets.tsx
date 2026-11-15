import { CodeBlock } from "@/components/ui"
import { CopyButton } from "@/features/integrations"

interface HeartbeatSnippetsProps {
  pingUrl: string | null
  intervalSeconds: number
}

function cronFor(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `*/${minutes} * * * *`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `0 */${hours} * * *` : "0 3 * * *"
}

export function HeartbeatSnippets({ pingUrl, intervalSeconds }: HeartbeatSnippetsProps) {
  if (!pingUrl) {
    return (
      <p className="text-sm text-muted-foreground">
        The secret ping URL is shown to engineers and admins.
      </p>
    )
  }
  const curl = "curl -fsS -m 10 --retry 5 -o /dev/null"
  const snippets = [
    { label: "When the job succeeds (GET, POST or HEAD)", code: `${curl} "${pingUrl}"` },
    {
      label: "When the job fails (the body becomes the incident cause)",
      code: `${curl} --data-raw "$ERROR_MESSAGE" "${pingUrl}/fail"`,
    },
    {
      label: "When the job starts (optional, tracks duration)",
      code: `${curl} "${pingUrl}/start?execution_id=$RUN_ID"`,
    },
    {
      label: "Cron",
      code: `${cronFor(intervalSeconds)} /usr/local/bin/backup.sh && ${curl} "${pingUrl}"`,
    },
  ]
  return (
    <div className="grid gap-4">
      {snippets.map((snippet) => (
        <div key={snippet.label} className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.8125rem] text-muted-foreground">{snippet.label}</span>
            <CopyButton text={snippet.code} label="Copy" />
          </div>
          <CodeBlock className="break-all whitespace-pre-wrap">{snippet.code}</CodeBlock>
        </div>
      ))}
    </div>
  )
}
