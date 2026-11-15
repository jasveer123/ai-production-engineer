"use client"

import * as React from "react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  Spinner,
} from "@/components/ui"

interface PromptDialogProps {
  triggerLabel: string
  title: string
  description: string
  fieldLabel: string
  confirmLabel: string
  initial?: string
  required?: boolean
  pending?: boolean
  variant?: "default" | "outline" | "secondary"
  onConfirm: (value: string) => void
}

export function PromptDialog({
  triggerLabel,
  title,
  description,
  fieldLabel,
  confirmLabel,
  initial = "",
  required,
  pending,
  variant = "outline",
  onConfirm,
}: PromptDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(initial)
  const id = React.useId()
  const valid = !required || value.trim().length >= 3

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    onConfirm(value.trim())
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setValue(initial)
      }}
    >
      <DialogTrigger render={<Button size="sm" variant={variant} disabled={pending} />}>
        {pending && <Spinner />} {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Field label={fieldLabel} htmlFor={id}>
            <Input
              id={id}
              value={value}
              maxLength={1000}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={!valid}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
