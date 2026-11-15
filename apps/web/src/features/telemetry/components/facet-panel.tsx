"use client"

import * as React from "react"
import { Eyebrow, Spinner } from "@/components/ui"
import { FACET_LABEL } from "../constants"
import type { ExploreParams } from "../explore-schemas"
import { useLogFacets } from "../hooks"
import { FacetGroup } from "./facet-group"

interface FacetPanelProps {
  workspaceId: string
  params: ExploreParams
  onFilter: (term: string) => void
}

const quote = (value: string) => (/[\s",]/.test(value) ? JSON.stringify(value) : value)

export function FacetPanel({ workspaceId, params, onFilter }: FacetPanelProps) {
  const [field, setField] = React.useState<string | undefined>()
  const { data, isPending } = useLogFacets(workspaceId, params, field)

  if (isPending) return <Spinner />
  if (!data) return null

  return (
    <aside className="grid content-start gap-4" aria-label="Fields">
      <span className="text-[0.6875rem] text-muted-foreground">
        From the newest {data.sampled.toLocaleString()} matching lines
      </span>
      {data.fields.map((group) => (
        <FacetGroup
          key={group.field}
          title={FACET_LABEL[group.field] ?? group.field}
          values={group.values}
          onInclude={(value) => onFilter(`${group.field}:${quote(value)}`)}
          onExclude={(value) => onFilter(`-${group.field}:${quote(value)}`)}
        />
      ))}
      {data.attributeKeys.length > 0 && (
        <div className="grid gap-1.5">
          <Eyebrow>Attributes</Eyebrow>
          <ul className="grid gap-0.5">
            {data.attributeKeys.map((key) => (
              <li key={key.value} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 truncate text-left font-mono text-[0.75rem] hover:underline"
                  aria-pressed={field === key.value}
                  onClick={() => setField(field === key.value ? undefined : key.value)}
                >
                  {key.value}
                </button>
                <button
                  type="button"
                  className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground hover:text-text"
                  aria-label={`Only lines with ${key.value}`}
                  onClick={() => onFilter(`${key.value}:*`)}
                >
                  {key.count}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
