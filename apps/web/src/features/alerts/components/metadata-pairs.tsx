"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button, Eyebrow, Input } from "@/components/ui"

export interface MetadataPair {
  key: string
  value: string
}

interface MetadataPairsProps {
  pairs: MetadataPair[]
  onChange: (pairs: MetadataPair[]) => void
}

export function MetadataPairs({ pairs, onChange }: MetadataPairsProps) {
  const update = (index: number, patch: Partial<MetadataPair>) =>
    onChange(pairs.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)))

  return (
    <div className="grid gap-2">
      <Eyebrow>Metadata</Eyebrow>
      {pairs.map((pair, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            aria-label={`Metadata key ${index + 1}`}
            placeholder="team"
            value={pair.key}
            maxLength={100}
            onChange={(event) => update(index, { key: event.target.value })}
          />
          <Input
            aria-label={`Metadata value ${index + 1}`}
            placeholder="payments"
            value={pair.value}
            maxLength={500}
            onChange={(event) => update(index, { value: event.target.value })}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Remove metadata ${index + 1}`}
            onClick={() => onChange(pairs.filter((_, i) => i !== index))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-fit"
        disabled={pairs.length >= 20}
        onClick={() => onChange([...pairs, { key: "", value: "" }])}
      >
        <Plus /> Add metadata
      </Button>
    </div>
  )
}
