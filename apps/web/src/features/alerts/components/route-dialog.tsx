"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
import {
  Button,
  Checkbox,
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
  Switch,
} from "@/components/ui"
import { CONDITION_FIELDS, CONDITION_OPS, SEVERITY_OPTIONS, VALUELESS_OPS } from "../constants"
import { useSaveRoute } from "../hooks"
import type { AlertRoute, AlertSource, Condition } from "../schemas"

interface RouteDialogProps {
  workspaceId: string
  route: AlertRoute | null
  sources: AlertSource[]
}

const selectClass =
  "h-9 border border-line-strong bg-panel-2 px-2 text-[0.8125rem] outline-none focus-visible:ring-3 focus-visible:ring-brand/40"

export function RouteDialog({ workspaceId, route, sources }: RouteDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(route?.name ?? "")
  const [sourceIds, setSourceIds] = React.useState<string[]>(route?.sourceIds ?? [])
  const [conditions, setConditions] = React.useState<Condition[]>(route?.conditions ?? [])
  const [groupBy, setGroupBy] = React.useState((route?.groupBy ?? []).join(", "))
  const [createIncident, setCreateIncident] = React.useState(route?.createIncident ?? true)
  const [severity, setSeverity] = React.useState<string | null>(route?.incidentSeverity ?? null)
  const save = useSaveRoute(workspaceId)

  const update = (index: number, patch: Partial<Condition>) =>
    setConditions((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    save.mutate(
      {
        id: route?.id ?? null,
        body: {
          name: name.trim(),
          enabled: route?.enabled ?? true,
          sourceIds,
          conditions: conditions.map((item) =>
            VALUELESS_OPS.includes(item.op) ? { field: item.field, op: item.op } : item
          ),
          groupBy: groupBy
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          createIncident,
          incidentSeverity: createIncident ? severity : null,
        },
      },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={<Button size={route ? "xs" : "sm"} variant={route ? "outline" : "default"} />}
      >
        {route ? (
          "Edit"
        ) : (
          <>
            <Plus /> New route
          </>
        )}
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>{route ? "Edit route" : "New route"}</DrawerTitle>
            <DrawerDescription>
              Routes are checked from the top. The first one that matches decides what happens to an
              alert.
            </DrawerDescription>
          </DrawerHeader>
          <Field label="Name" htmlFor="route-name">
            <Input
              id="route-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Page for critical production alerts"
            />
          </Field>
          <div className="grid gap-2">
            <Eyebrow>Sources (none selected means all)</Eyebrow>
            {sources.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground">Create a source first.</p>
            ) : (
              sources.map((source) => (
                <label key={source.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={sourceIds.includes(source.id)}
                    onCheckedChange={(checked) =>
                      setSourceIds((list) =>
                        checked ? [...list, source.id] : list.filter((id) => id !== source.id)
                      )
                    }
                  />
                  {source.name}
                </label>
              ))
            )}
          </div>
          <div className="grid gap-2">
            <Eyebrow>Only when</Eyebrow>
            {conditions.map((condition, index) => {
              const custom =
                !CONDITION_FIELDS.includes(condition.field as never) &&
                !condition.field.startsWith("label.")
              return (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Field"
                    className={selectClass}
                    value={condition.field.startsWith("label.") ? "label." : condition.field}
                    onChange={(e) => update(index, { field: e.target.value })}
                  >
                    {CONDITION_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {field === "label." ? "label" : field}
                      </option>
                    ))}
                  </select>
                  {(condition.field.startsWith("label.") || custom) && (
                    <Input
                      aria-label="Label name"
                      className="w-28"
                      value={condition.field.replace("label.", "")}
                      onChange={(e) => update(index, { field: `label.${e.target.value}` })}
                      placeholder="service"
                    />
                  )}
                  <select
                    aria-label="Operator"
                    className={selectClass}
                    value={condition.op}
                    onChange={(e) => update(index, { op: e.target.value })}
                  >
                    {CONDITION_OPS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  {!VALUELESS_OPS.includes(condition.op) && (
                    <Input
                      aria-label="Value"
                      className="w-40"
                      value={condition.value ?? ""}
                      onChange={(e) => update(index, { value: e.target.value })}
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove condition"
                    onClick={() => setConditions((list) => list.filter((_, i) => i !== index))}
                  >
                    <X />
                  </Button>
                </div>
              )
            })}
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="w-fit"
              onClick={() =>
                setConditions((list) => [
                  ...list,
                  { field: "severity", op: "eq", value: "critical" },
                ])
              }
            >
              <Plus /> Add condition
            </Button>
          </div>
          <Field
            label="Group alerts by labels (comma separated)"
            htmlFor="route-group"
            help="Alerts with the same values share one incident."
          >
            <Input
              id="route-group"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              placeholder="service, environment"
            />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={createIncident} onCheckedChange={setCreateIncident} />
            Open an incident for matching alerts
          </label>
          {createIncident && (
            <div className="grid gap-2">
              <Eyebrow>Incident severity</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <Chip type="button" selected={severity === null} onClick={() => setSeverity(null)}>
                  From the alert
                </Chip>
                {SEVERITY_OPTIONS.map((item) => (
                  <Chip
                    key={item}
                    type="button"
                    selected={severity === item}
                    onClick={() => setSeverity(item)}
                  >
                    {item}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <DrawerFooter>
            <Button type="submit" disabled={!name.trim() || save.isPending}>
              {save.isPending && <Spinner />} Save route
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
