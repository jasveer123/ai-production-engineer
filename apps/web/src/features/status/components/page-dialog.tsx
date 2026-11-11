"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import {
  Button,
  Chip,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Eyebrow,
  Field,
  Input,
  Spinner,
} from "@/components/ui"
import { useMonitors } from "@/features/monitors"
import { useCreatePage } from "../hooks"

interface PageDialogProps {
  workspaceId: string
}

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)

export function PageDialog({ workspaceId }: PageDialogProps) {
  const monitors = useMonitors(workspaceId)
  const create = useCreatePage(workspaceId)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [touched, setTouched] = React.useState(false)
  const [description, setDescription] = React.useState("")
  const [selected, setSelected] = React.useState<string[]>([])
  const valid = name.trim() && slug.length >= 3

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    create.mutate(
      { name: name.trim(), slug, description: description.trim(), monitorIds: selected },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button size="sm" />}>
        <Plus /> New status page
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>New status page</DrawerTitle>
            <DrawerDescription>
              A public page anyone can open without signing in. It shows the monitors you pick.
            </DrawerDescription>
          </DrawerHeader>
          <Field label="Name" htmlFor="page-name">
            <Input
              id="page-name"
              value={name}
              maxLength={80}
              onChange={(e) => {
                setName(e.target.value)
                if (!touched) setSlug(toSlug(e.target.value))
              }}
              placeholder="Acme status"
            />
          </Field>
          <Field label="Address" htmlFor="page-slug" help={`/status/${slug || "your-name"}`}>
            <Input
              id="page-slug"
              value={slug}
              maxLength={40}
              onChange={(e) => {
                setTouched(true)
                setSlug(toSlug(e.target.value))
              }}
            />
          </Field>
          <Field label="Short note (optional)" htmlFor="page-description">
            <Input
              id="page-description"
              value={description}
              maxLength={300}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid gap-2">
            <Eyebrow>Show these monitors</Eyebrow>
            {(monitors.data ?? []).length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground">
                You have no monitors yet. Add some under Monitors, then edit this page.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(monitors.data ?? []).map((monitor) => (
                  <Chip
                    key={monitor.id}
                    selected={selected.includes(monitor.id)}
                    onClick={() =>
                      setSelected((list) =>
                        list.includes(monitor.id)
                          ? list.filter((id) => id !== monitor.id)
                          : [...list, monitor.id]
                      )
                    }
                  >
                    {monitor.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>
          <DrawerFooter>
            <Button type="submit" disabled={!valid || create.isPending}>
              {create.isPending && <Spinner />} Create page
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
