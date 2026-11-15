"use client"

import { Bookmark, Trash2 } from "lucide-react"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui"
import type { ExploreParams, SavedQuery } from "../explore-schemas"
import { useSavedQueries } from "../hooks"

interface SavedQueriesMenuProps {
  workspaceId: string
  signal: SavedQuery["signal"]
  current: ExploreParams
  onPick: (saved: SavedQuery) => void
}

export function SavedQueriesMenu({ workspaceId, signal, current, onPick }: SavedQueriesMenuProps) {
  const { list, create, remove } = useSavedQueries(workspaceId, signal)
  const saved = list.data ?? []

  const onSave = () => {
    const name = window.prompt("Name this query")?.trim()
    if (name) create.mutate({ name, query: current.q, range: current.range })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
        <Bookmark /> Saved
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 min-w-72 overflow-y-auto">
        <DropdownMenuItem onClick={onSave} disabled={create.isPending}>
          Save current query
        </DropdownMenuItem>
        {saved.length > 0 && <DropdownMenuSeparator />}
        {saved.map((item) => (
          <DropdownMenuItem key={item.id} onClick={() => onPick(item)}>
            <span className="grid min-w-0 flex-1">
              <span className="truncate">{item.name}</span>
              <span className="truncate font-mono text-[0.6875rem] text-muted-foreground">
                {item.query || "everything"} · {item.range}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${item.name}`}
              onClick={(event) => {
                event.stopPropagation()
                remove.mutate(item.id)
              }}
            >
              <Trash2 />
            </Button>
          </DropdownMenuItem>
        ))}
        {saved.length === 0 && (
          <p className="px-2 py-1.5 text-[0.75rem] text-muted-foreground">No saved queries yet.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
