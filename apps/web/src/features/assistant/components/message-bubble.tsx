import Link from "next/link"
import type { ChatMessage } from "../schemas"
import { sourceHref } from "../lib/source-href"

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="grid gap-1 border-t border-line pt-4 first:border-t-0 first:pt-0">
        <span className="text-xs font-medium text-muted-foreground">Question</span>
        <p className="text-[0.9375rem] font-medium whitespace-pre-wrap">{message.content}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <span className="text-xs font-medium text-muted-foreground">Answer</span>
      <p className="max-w-prose text-sm leading-6 whitespace-pre-wrap">{message.content}</p>
      {message.sources.length > 0 ? (
        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Evidence, {message.sources.length}
          </span>
          <ul className="divide-y divide-line border border-line bg-panel">
            {message.sources.map((source) => {
              const href = sourceHref(source)
              const row = (
                <span className="flex items-center gap-3 px-3 py-2 text-[0.8125rem]">
                  <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                    {source.kind}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{source.title}</span>
                  {href && <span className="text-brand-strong">Open</span>}
                </span>
              )

              return (
                <li key={source.ref}>
                  {href ? (
                    <Link
                      href={href}
                      className="block outline-none hover:bg-panel-2 focus-visible:bg-panel-2"
                    >
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="text-[0.8125rem] text-muted-foreground">
          No workspace records were cited for this answer. Treat it as general guidance.
        </p>
      )}
    </div>
  )
}
