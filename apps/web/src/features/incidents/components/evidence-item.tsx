"use client"

import * as React from "react"
import { ChevronRight, ExternalLink } from "lucide-react"
import { Badge, Spinner } from "@/components/ui"
import { cn } from "@/lib/utils"
import { useEvidenceContent } from "../hooks"
import type { EvidenceRef } from "../schemas"

interface EvidenceItemProps {
  workspaceId: string
  incidentId: string
  evidence: EvidenceRef
}

export function EvidenceItem({ workspaceId, incidentId, evidence }: EvidenceItemProps) {
  const [open, setOpen] = React.useState(false)
  const content = useEvidenceContent(workspaceId, incidentId, evidence.id, open)

  return (
    <li id={`evidence-${evidence.ref}`} className="border border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-panel-2 focus-visible:ring-3 focus-visible:ring-brand/40"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <Badge>{evidence.ref}</Badge>
        <Badge variant="outline">{evidence.kind.replace("_", " ")}</Badge>
        <span className="min-w-0 flex-1 truncate text-[0.8125rem]">{evidence.title}</span>
        {evidence.sourceUrl && (
          <a
            href={evidence.sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="text-muted-foreground hover:text-brand"
            aria-label="Open source"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </button>
      {open && (
        <div className="border-t border-line bg-sunken p-3">
          {content.isPending ? (
            <Spinner />
          ) : content.data ? (
            <pre className="max-h-80 overflow-auto font-mono text-[0.75rem] leading-5 whitespace-pre-wrap">
              {content.data.content}
            </pre>
          ) : (
            <p className="text-[0.8125rem] text-muted-foreground">
              The saved content for this evidence is not available.
            </p>
          )}
        </div>
      )}
    </li>
  )
}
