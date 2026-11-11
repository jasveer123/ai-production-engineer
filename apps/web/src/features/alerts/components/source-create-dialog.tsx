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
import {
  HEARTBEAT_GRACES,
  HEARTBEAT_INTERVALS,
  SOURCE_KIND_LABEL,
  WEBHOOK_KINDS,
} from "../constants"
import { useCreateSource } from "../hooks"
import type { AlertSourceWithToken } from "../schemas"

interface SourceCreateDialogProps {
  workspaceId: string
  fixedKind?: "heartbeat"
  triggerLabel: string
  onCreated: (source: AlertSourceWithToken) => void
}

export function SourceCreateDialog({
  workspaceId,
  fixedKind,
  triggerLabel,
  onCreated,
}: SourceCreateDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [kind, setKind] = React.useState<string>(fixedKind ?? "http")
  const [name, setName] = React.useState("")
  const [interval, setInterval] = React.useState<number>(HEARTBEAT_INTERVALS[1].seconds)
  const [grace, setGrace] = React.useState<number>(HEARTBEAT_GRACES[0].seconds)
  const create = useCreateSource(workspaceId)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    create.mutate(
      {
        kind,
        name: name.trim(),
        ...(kind === "heartbeat" ? { intervalSeconds: interval, graceSeconds: grace } : {}),
      },
      {
        onSuccess: (source) => {
          onCreated(source)
          setName("")
          setOpen(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{kind === "heartbeat" ? "New heartbeat" : "New alert source"}</DialogTitle>
            <DialogDescription>
              {kind === "heartbeat"
                ? "Your job calls a URL on a schedule. If a call is missing, Pramaan opens an alert."
                : "Pick the tool that will send alerts. You get a URL and a token to paste into it."}
            </DialogDescription>
          </DialogHeader>
          {!fixedKind && (
            <div className="grid gap-2">
              <Eyebrow>Tool</Eyebrow>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_KINDS.map((item) => (
                  <Chip
                    key={item}
                    type="button"
                    selected={kind === item}
                    onClick={() => setKind(item)}
                  >
                    {SOURCE_KIND_LABEL[item]}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <Field label="Name" htmlFor="source-name">
            <Input
              id="source-name"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder={kind === "heartbeat" ? "Nightly backup" : "Production alerts"}
            />
          </Field>
          {kind === "heartbeat" && (
            <>
              <div className="grid gap-2">
                <Eyebrow>It should call every</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {HEARTBEAT_INTERVALS.map((item) => (
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
                <Eyebrow>Wait this long before alerting</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {HEARTBEAT_GRACES.map((item) => (
                    <Chip
                      key={item.seconds}
                      type="button"
                      selected={grace === item.seconds}
                      onClick={() => setGrace(item.seconds)}
                    >
                      {item.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending && <Spinner />} Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
