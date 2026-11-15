import { Check, Copy } from "lucide-react"
import { Button, CodeBlock } from "@/components/ui"
import { useCopy } from "@/lib/hooks/use-copy"

interface MonitorBadgeProps {
  name: string
  url: string
}

export function MonitorBadge({ name, url }: MonitorBadgeProps) {
  const { copied, copy } = useCopy()
  const markdown = `![${name.replace(/[[\]]/g, "")}](${url})`
  return (
    <div className="grid gap-3">
      <img src={url} alt={`${name} status badge`} className="h-5 w-fit" />
      <div className="flex items-start gap-2">
        <CodeBlock className="min-w-0 flex-1 overflow-x-auto text-[0.75rem]">{markdown}</CodeBlock>
        <Button size="sm" variant="outline" onClick={() => void copy(markdown)}>
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-[0.8125rem] text-muted-foreground">
        Public image for a README. The link is unguessable; anyone with it sees only the name and
        state.
      </p>
    </div>
  )
}
