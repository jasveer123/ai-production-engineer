"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { Button, Spinner } from "@/components/ui"
import { useMonitors } from "@/features/monitors"
import { useSaveStructure } from "../hooks"
import type { SectionDraft } from "../requests"
import type { Structure } from "../schemas"
import { move, newKey, toDrafts, toPayload } from "../structure-draft"
import { SectionEditor } from "./section-editor"

interface StructureEditorProps {
  workspaceId: string
  pageId: string
  initial: Structure
  canManage: boolean
}

export function StructureEditor({ workspaceId, pageId, initial, canManage }: StructureEditorProps) {
  const monitors = useMonitors(workspaceId)
  const save = useSaveStructure(workspaceId, pageId)
  const [sections, setSections] = React.useState<SectionDraft[]>(() => toDrafts(initial))
  const states = new Map(initial.sections.flatMap((s) => s.resources.map((r) => [r.id, r.state])))
  const invalid = sections.some((s) => s.resources.some((r) => !r.publicName.trim()))

  const replace = (index: number, next: SectionDraft | null) =>
    setSections((list) =>
      next ? list.map((s, i) => (i === index ? next : s)) : list.filter((_, i) => i !== index)
    )

  return (
    <div className="grid gap-4">
      <p className="text-[0.8125rem] text-muted-foreground">
        Sections group resources. A resource shows a public name; link one or more monitors and the
        worst state wins, or leave it manual and set its state yourself.
      </p>
      {sections.map((section, index) => (
        <SectionEditor
          key={section.key}
          section={section}
          monitors={(monitors.data ?? []).map((m) => ({ id: m.id, name: m.name }))}
          states={states}
          disabled={!canManage}
          onChange={(next) => replace(index, next)}
          onRemove={() => replace(index, null)}
          onMove={(delta) => setSections((list) => move(list, index, delta))}
        />
      ))}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSections((list) => [...list, { key: newKey(), name: "", resources: [] }])
            }
          >
            <Plus /> Add section
          </Button>
          <Button
            size="sm"
            disabled={invalid || save.isPending}
            onClick={() => save.mutate(toPayload(sections))}
          >
            {save.isPending && <Spinner />} Save structure
          </Button>
          {invalid && (
            <span className="self-center text-[0.8125rem] text-danger">
              Every resource needs a public name.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
