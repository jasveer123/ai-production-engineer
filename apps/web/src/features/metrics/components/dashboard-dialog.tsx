"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
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
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button size="sm" variant="outline" />}>
        <Plus /> New dashboard
      </DrawerTrigger>
      <DrawerContent>
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>New dashboard</DrawerTitle>
            <DrawerDescription>
              A dashboard is a set of charts you want to watch together.
            </DrawerDescription>
          </DrawerHeader>
          <Field label="Name" htmlFor="dashboard-name">
            <Input
              id="dashboard-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production overview"
            />
          </Field>
          <DrawerFooter>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending && <Spinner />} Create dashboard
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
