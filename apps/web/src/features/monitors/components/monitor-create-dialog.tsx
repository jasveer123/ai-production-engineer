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
import { CONFIRMATIONS, INTERVALS, KINDS } from "../constants"
import { useCreateMonitor, useUpdateMonitor } from "../hooks"
import type { Monitor } from "../schemas"

interface MonitorCreateDialogProps {
  workspaceId: string
  monitor?: Monitor
}

export function MonitorCreateDialog({ workspaceId, monitor }: MonitorCreateDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [kind, setKind] = React.useState(monitor?.kind ?? "http")
  const [name, setName] = React.useState(monitor?.name ?? "")
  const [url, setUrl] = React.useState(monitor?.url ?? "")
  const [host, setHost] = React.useState(monitor?.host ?? "")
  const [port, setPort] = React.useState(monitor?.port ? String(monitor.port) : "")
  const [keyword, setKeyword] = React.useState(monitor?.keyword ?? "")
  const [absent, setAbsent] = React.useState(monitor?.keywordMode === "absent")
  const [status, setStatus] = React.useState(String(monitor?.expectedStatus ?? 200))
  const [interval, setInterval] = React.useState<number>(monitor?.intervalSeconds ?? 180)
  const [confirmations, setConfirmations] = React.useState<number>(monitor?.confirmations ?? 2)
  const createMutation = useCreateMonitor(workspaceId)
  const updateMutation = useUpdateMonitor(workspaceId)
  const pending = createMutation.isPending || updateMutation.isPending
  const tcp = kind === "tcp"
  const valid =
    name.trim() &&
    (tcp ? host.trim() && Number(port) > 0 : url.trim()) &&
    (kind !== "keyword" || keyword.trim()) &&
    (kind !== "status" || Number(status) > 0)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    if (monitor) {
      updateMutation.mutate(
        {
          id: monitor.id,
          body: {
            name: name.trim(),
            intervalSeconds: interval,
            confirmations,
            ...(tcp ? { host: host.trim(), port: Number(port) } : { url: url.trim() }),
            ...(kind === "keyword"
              ? { keyword: keyword.trim(), keywordMode: absent ? "absent" : "present" }
              : {}),
            ...(kind === "status" ? { expectedStatus: Number(status) } : {}),
          },
        },
        { onSuccess: () => setOpen(false) }
      )
      return
    }
    createMutation.mutate(
      {
        name: name.trim(),
        kind,
        intervalSeconds: interval,
        confirmations,
        ...(tcp ? { host: host.trim(), port: Number(port) } : { url: url.trim() }),
        ...(kind === "keyword"
          ? { keyword: keyword.trim(), keywordMode: absent ? "absent" : "present" }
          : {}),
        ...(kind === "status" ? { expectedStatus: Number(status) } : {}),
      },
      {
        onSuccess: () => {
          setName("")
          setUrl("")
          setOpen(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={monitor ? "outline" : "default"} />}>
        {monitor ? (
          "Edit"
        ) : (
          <>
            <Plus /> New monitor
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{monitor ? "Edit monitor" : "New monitor"}</DialogTitle>
            <DialogDescription>{KINDS.find((item) => item.value === kind)?.hint}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2" hidden={Boolean(monitor)}>
            {KINDS.map((item) => (
              <Chip
                key={item.value}
                type="button"
                selected={kind === item.value}
                onClick={() => setKind(item.value)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
          <Field label="Name" htmlFor="monitor-name">
            <Input
              id="monitor-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Shop home page"
            />
          </Field>
          {tcp ? (
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <Field label="Host" htmlFor="monitor-host">
                <Input
                  id="monitor-host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="db.example.com"
                />
              </Field>
              <Field label="Port" htmlFor="monitor-port">
                <Input
                  id="monitor-port"
                  inputMode="numeric"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="5432"
                />
              </Field>
            </div>
          ) : (
            <Field label="Address" htmlFor="monitor-url">
              <Input
                id="monitor-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </Field>
          )}
          {kind === "keyword" && (
            <div className="grid gap-2">
              <Field label="Word to look for" htmlFor="monitor-keyword">
                <Input
                  id="monitor-keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <Chip type="button" selected={!absent} onClick={() => setAbsent(false)}>
                  Alert when it is missing
                </Chip>
                <Chip type="button" selected={absent} onClick={() => setAbsent(true)}>
                  Alert when it appears
                </Chip>
              </div>
            </div>
          )}
          {kind === "status" && (
            <Field label="Expected status code" htmlFor="monitor-status">
              <Input
                id="monitor-status"
                inputMode="numeric"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              />
            </Field>
          )}
          <div className="grid gap-2">
            <Eyebrow>Check every</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {INTERVALS.map((item) => (
                <Chip
                  key={item.seconds}
                  type="button"
                  selected={interval === item.seconds}
                  onClick={() => setInterval(item.seconds)}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Eyebrow>Failed checks in a row before alerting</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {CONFIRMATIONS.map((item) => (
                <Chip
                  key={item}
                  type="button"
                  selected={confirmations === item}
                  onClick={() => setConfirmations(item)}
                >
                  {item}
                </Chip>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!valid || pending}>
              {pending && <Spinner />} {monitor ? "Save monitor" : "Create monitor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
