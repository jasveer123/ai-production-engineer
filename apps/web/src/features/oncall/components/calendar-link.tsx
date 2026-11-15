"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui"
import { CopyButton } from "@/features/integrations"
import { useCalendarLink } from "../hooks"

interface CalendarLinkProps {
  workspaceId: string
  scheduleId: string
  enabled: boolean
}

export function CalendarLink({ workspaceId, scheduleId, enabled }: CalendarLinkProps) {
  const link = useCalendarLink(workspaceId)
  const [url, setUrl] = React.useState<string | null>(null)

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="xs"
          disabled={link.isPending}
          onClick={() =>
            link.mutate(
              { id: scheduleId, enable: true },
              { onSuccess: (r) => setUrl(r?.url ?? null) }
            )
          }
        >
          <CalendarDays /> {enabled ? "New calendar link" : "Calendar link"}
        </Button>
        {enabled && (
          <Button
            variant="ghost"
            size="xs"
            disabled={link.isPending}
            onClick={() =>
              link.mutate({ id: scheduleId, enable: false }, { onSuccess: () => setUrl(null) })
            }
          >
            Revoke link
          </Button>
        )}
      </div>
      {url && (
        <div className="flex items-center justify-between gap-2 border border-line bg-sunken py-1 pr-1 pl-3 font-mono text-[0.75rem]">
          <span className="min-w-0 truncate">{url}</span>
          <CopyButton text={url} label="Copy" />
        </div>
      )}
      {url && (
        <p className="text-[0.75rem] text-muted-foreground">
          Subscribe to this address in your calendar app. It is shown once; a new link replaces it.
        </p>
      )}
    </div>
  )
}
