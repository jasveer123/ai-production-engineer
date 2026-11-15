"use client"

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react"
import { Button, Input } from "@/components/ui"
import type { SectionDraft } from "../requests"
import { emptyResource, move } from "../structure-draft"
import { ResourceEditor } from "./resource-editor"

interface SectionEditorProps {
  section: SectionDraft
  monitors: { id: string; name: string }[]
  states: Map<string, string>
  disabled: boolean
  onChange: (next: SectionDraft) => void
  onRemove: () => void
  onMove: (delta: number) => void
}

export function SectionEditor({
  section,
  monitors,
  states,
  disabled,
  onChange,
  onRemove,
  onMove,
}: SectionEditorProps) {
  const setResources = (resources: SectionDraft["resources"]) => onChange({ ...section, resources })

  return (
    <section
      className="grid gap-3 border border-line bg-panel p-4"
      aria-label={section.name || "Section"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Section name"
          className="w-72"
          maxLength={80}
          disabled={disabled}
          value={section.name}
          placeholder="Section name (optional)"
          onChange={(e) => onChange({ ...section, name: e.target.value })}
        />
        {!disabled && (
          <div className="ml-auto flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move section up"
              onClick={() => onMove(-1)}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move section down"
              onClick={() => onMove(1)}
            >
              <ArrowDown />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Remove section" onClick={onRemove}>
              <X />
            </Button>
          </div>
        )}
      </div>
      {section.resources.map((resource, index) => (
        <ResourceEditor
          key={resource.key}
          resource={resource}
          monitors={monitors}
          state={resource.id ? states.get(resource.id) : undefined}
          disabled={disabled}
          onChange={(next) =>
            setResources(section.resources.map((r, i) => (i === index ? next : r)))
          }
          onRemove={() => setResources(section.resources.filter((_, i) => i !== index))}
          onMove={(delta) => setResources(move(section.resources, index, delta))}
        />
      ))}
      {section.resources.length === 0 && (
        <p className="text-[0.8125rem] text-muted-foreground">No resources in this section yet.</p>
      )}
      {!disabled && (
        <Button
          variant="outline"
          size="xs"
          className="w-fit"
          onClick={() => setResources([...section.resources, emptyResource()])}
        >
          <Plus /> Add resource
        </Button>
      )}
    </section>
  )
}
