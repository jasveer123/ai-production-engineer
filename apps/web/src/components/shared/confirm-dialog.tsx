"use client"

import * as React from "react"
import { Button } from "@/components/ui"

interface ConfirmDialogProps {
  triggerLabel: string
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: ConfirmDialogProps) {
  const [asking, setAsking] = React.useState(false)

  if (!asking) {
    return (
      <Button variant="destructive" size="xs" disabled={pending} onClick={() => setAsking(true)}>
        {triggerLabel}
      </Button>
    )
  }

  return (
    <span
      role="group"
      aria-label={title}
      title={description}
      className="inline-flex flex-wrap items-center gap-2 border border-danger/40 bg-danger-soft px-2 py-1"
    >
      <span className="text-[0.75rem] text-danger">{title}</span>
      <span className="sr-only">{description}</span>
      <Button
        variant="destructive"
        size="xs"
        autoFocus
        disabled={pending}
        onClick={() => {
          onConfirm()
          setAsking(false)
        }}
      >
        {confirmLabel}
      </Button>
      <Button variant="ghost" size="xs" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </span>
  )
}
