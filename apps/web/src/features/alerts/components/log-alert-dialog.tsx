"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import {
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Eyebrow,
  Field,
  Input,
  Spinner,
} from "@/components/ui"
import { LOG_ALERT_SEVERITIES, LOG_LEVEL_OPTIONS } from "../constants"
import { useCreateLogAlert, useUpdateLogAlert } from "../hooks"
import type { LogAlert } from "../schemas"

interface LogAlertDialogProps {
  workspaceId: string
  alert?: LogAlert
}

export function LogAlertDialog({ workspaceId, alert }: LogAlertDialogProps) {
  const create = useCreateLogAlert(workspaceId)
  const update = useUpdateLogAlert(workspaceId)
  const pending = create.isPending || update.isPending
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(alert?.name ?? "")
  const [levels, setLevels] = React.useState<string[]>(alert?.levels ?? ["error", "fatal"])
  const [service, setService] = React.useState(alert?.service ?? "")
  const [contains, setContains] = React.useState(alert?.contains ?? "")
  const [threshold, setThreshold] = React.useState(alert?.threshold ?? 10)
  const [windowMinutes, setWindowMinutes] = React.useState(alert?.windowMinutes ?? 5)
  const [severity, setSeverity] = React.useState(alert?.severity ?? "high")
  const valid = name.trim() && levels.length > 0 && threshold >= 1 && windowMinutes >= 1

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    const body = {
      name: name.trim(),
      levels,
      threshold,
      windowMinutes,
      severity,
    }
    if (alert) {
      update.mutate(
        {
          id: alert.id,
          body: { ...body, service: service.trim() || null, contains: contains.trim() || null },
        },
        { onSuccess: () => setOpen(false) }
      )
      return
    }
    create.mutate(
      {
        ...body,
        ...(service.trim() ? { service: service.trim() } : {}),
        ...(contains.trim() ? { contains: contains.trim() } : {}),
      },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={alert ? "outline" : "default"} />}>
        {alert ? (
          "Edit"
        ) : (
          <>
            <Plus /> New log alert
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{alert ? "Edit log alert" : "New log alert"}</DialogTitle>
            <DialogDescription>
              Raise an alert when enough matching logs arrive in a short time. It resolves itself
              when the logs calm down.
            </DialogDescription>
          </DialogHeader>
          <Field label="Name" htmlFor="log-alert-name">
            <Input
              id="log-alert-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Checkout errors"
            />
          </Field>
          <div className="grid gap-2">
            <Eyebrow>Log levels</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {LOG_LEVEL_OPTIONS.map((item) => (
                <Chip
                  key={item}
                  selected={levels.includes(item)}
                  onClick={() =>
                    setLevels((list) =>
                      list.includes(item) ? list.filter((l) => l !== item) : [...list, item]
                    )
                  }
                >
                  {item}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="Service (optional)" htmlFor="log-alert-service">
            <Input
              id="log-alert-service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="checkout"
            />
          </Field>
          <Field label="Message contains (optional)" htmlFor="log-alert-contains">
            <Input
              id="log-alert-contains"
              value={contains}
              onChange={(e) => setContains(e.target.value)}
              placeholder="timeout"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="At least this many logs" htmlFor="log-alert-threshold">
              <Input
                id="log-alert-threshold"
                type="number"
                min={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </Field>
            <Field label="Within minutes" htmlFor="log-alert-window">
              <Input
                id="log-alert-window"
                type="number"
                min={1}
                max={1440}
                value={windowMinutes}
                onChange={(e) => setWindowMinutes(Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="grid gap-2">
            <Eyebrow>Severity</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {LOG_ALERT_SEVERITIES.map((item) => (
                <Chip key={item} selected={severity === item} onClick={() => setSeverity(item)}>
                  {item}
                </Chip>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!valid || pending}>
              {pending && <Spinner />} {alert ? "Save alert" : "Create alert"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
