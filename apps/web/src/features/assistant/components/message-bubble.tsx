import Link from "next/link"
import { Badge } from "@/components/ui"
import { cn } from "@/lib/utils"
import { sourceHref } from "../lib/source-href"
import type { ChatMessage } from "../schemas"

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const mine = message.role === "user"

  return (
    <div className={cn("flex", mine && "justify-end")}>
      <div
        className={cn(
          "grid max-w-[85%] gap-2 border p-4 text-sm leading-6",
          mine ? "border-brand bg-brand-soft" : "border-line bg-panel"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[0.75rem] text-muted-foreground">Based on</span>
            {message.sources.map((source) => {
              const href = sourceHref(source)
              const badge = (
                <Badge variant={href ? "ai" : "default"}>
                  {source.kind}: {source.title.slice(0, 40)}
                </Badge>
              )

              return href ? (
                <Link key={source.ref} href={href}>
                  {badge}
                </Link>
              ) : (
                <span key={source.ref}>{badge}</span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
