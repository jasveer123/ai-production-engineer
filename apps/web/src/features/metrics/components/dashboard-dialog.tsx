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
  Textarea,
} from "@/components/ui"
import { useCreateDashboard, useDashboardTemplates } from "../hooks"
import { dashboardBodySchema, type DashboardBody } from "../schemas"
import { ChoiceChips } from "./choice-chips"

interface DashboardDialogProps {
  workspaceId: string
  onCreated: (id: string) => void
}

function parseImport(text: string): DashboardBody | string {
  try {
    const parsed = dashboardBodySchema.safeParse(JSON.parse(text))
    return parsed.success
      ? parsed.data
      : `Not a dashboard: ${parsed.error.issues[0]?.path.join(".") ?? "body"}`
  } catch {
    return "That is not valid JSON."
  }
}

export function DashboardDialog({ workspaceId, onCreated }: DashboardDialogProps) {
  const create = useCreateDashboard(workspaceId)
  const [open, setOpen] = React.useState(false)
  const [source, setSource] = React.useState("blank")
  const [name, setName] = React.useState("")
  const [json, setJson] = React.useState("")
  const templates = useDashboardTemplates(workspaceId, open)
  const template = templates.data?.find((t) => t.id === source)
  const imported = source === "import" && json.trim() ? parseImport(json) : null
  const importError = typeof imported === "string" ? imported : null

  const body = (): DashboardBody | null => {
    if (source === "import") return imported && typeof imported !== "string" ? imported : null
    if (template) return { ...template.dashboard, name: name.trim() || template.dashboard.name }
    return name.trim() ? { name: name.trim(), widgets: [], variables: [] } : null
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const next = body()
    if (!next) return
    create.mutate(next, {
      onSuccess: (dashboard) => {
        setOpen(false)
        setName("")
        setJson("")
        onCreated(dashboard.id)
      },
    })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button size="sm" variant="outline" />}>
        <Plus /> New dashboard
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>New dashboard</DrawerTitle>
            <DrawerDescription>
              Start blank, from a template, or paste an exported dashboard.
            </DrawerDescription>
          </DrawerHeader>
          <ChoiceChips
            label="Start from"
            options={[
              { value: "blank", label: "Blank" },
              ...(templates.data ?? []).map((t) => ({ value: t.id, label: t.name })),
              { value: "import", label: "Import JSON" },
            ]}
            value={source}
            onChange={setSource}
            help={template?.description}
          />
          {source === "import" ? (
            <Field label="Dashboard JSON" htmlFor="dashboard-json" error={importError ?? undefined}>
              <Textarea
                id="dashboard-json"
                rows={8}
                className="font-mono text-[0.75rem]"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder='{"name":"API","widgets":[],"variables":[]}'
              />
            </Field>
          ) : (
            <Field label="Name" htmlFor="dashboard-name">
              <Input
                id="dashboard-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder={template?.dashboard.name ?? "Production overview"}
              />
            </Field>
          )}
          <DrawerFooter>
            <Button type="submit" disabled={!body() || create.isPending}>
              {create.isPending && <Spinner />} Create dashboard
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
