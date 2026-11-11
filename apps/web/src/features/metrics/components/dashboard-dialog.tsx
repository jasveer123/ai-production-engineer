"use client"

import * as React from "react"
import { Plus } from "lucide-react"
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
import { useCreateDashboard } from "../hooks"

interface DashboardDialogProps {
  workspaceId: string
  onCreated: (id: string) => void
}

export function DashboardDialog({ workspaceId, onCreated }: DashboardDialogProps) {
  const create = useCreateDashboard(workspaceId)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    create.mutate(name.trim(), {
      onSuccess: (dashboard) => {
        setOpen(false)
        setName("")
        onCreated(dashboard.id)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus /> New dashboard
      </DialogTrigger>
      <DialogContent>
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New dashboard</DialogTitle>
            <DialogDescription>
              A dashboard is a set of charts you want to watch together.
            </DialogDescription>
          </DialogHeader>
          <Field label="Name" htmlFor="dashboard-name">
            <Input
              id="dashboard-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production overview"
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending && <Spinner />} Create dashboard
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
