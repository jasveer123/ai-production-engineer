import { CodeBlock } from "@/components/ui"
import type { StepCode } from "../catalog"
import { CopyButton } from "./copy-button"

interface SnippetBlockProps {
  code: StepCode
}

export function SnippetBlock({ code }: SnippetBlockProps) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-sunken">
      <div className="flex items-center justify-between border-b border-line py-0.5 pr-1 pl-3">
        <span className="font-mono text-[0.6875rem] text-muted-foreground">
          {code.filename ?? "snippet"}
        </span>
        <CopyButton text={code.content} label="Copy snippet" />
      </div>
      <CodeBlock className="rounded-none border-0 bg-transparent">{code.content}</CodeBlock>
    </div>
  )
}
