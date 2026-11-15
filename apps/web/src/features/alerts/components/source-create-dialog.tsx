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
import { SOURCE_KIND_LABEL, WEBHOOK_KINDS } from "../constants"
import { useCreateSource } from "../hooks"
import { pairsToRecord } from "../lib"
import type { AlertSourceWithToken } from "../schemas"
import { DurationInput } from "./duration-input"
import { MetadataPairs, type MetadataPair } from "./metadata-pairs"
import { PolicySelect } from "./policy-select"

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
  const [interval, setInterval] = React.useState(300)
  const [grace, setGrace] = React.useState(60)
  const [metadata, setMetadata] = React.useState<MetadataPair[]>([])
  const [policyId, setPolicyId] = React.useState<string | null>(null)
  const create = useCreateSource(workspaceId)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    create.mutate(
      {
        kind,
        name: name.trim(),
        escalationPolicyId: policyId,
        ...(kind === "heartbeat"
          ? { intervalSeconds: interval, graceSeconds: grace, metadata: pairsToRecord(metadata) }
          : {}),
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
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button size="sm" />}>
        <Plus /> {triggerLabel}
      </DrawerTrigger>
      <DrawerContent>
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>{kind === "heartbeat" ? "New heartbeat" : "New alert source"}</DrawerTitle>
            <DrawerDescription>
              {kind === "heartbeat"
                ? "Your job calls a URL on a schedule. If a call is missing, Pramaan opens an alert."
                : "Pick the tool that will send alerts. You get a URL and a token to paste into it."}
            </DrawerDescription>
          </DrawerHeader>
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
              <DurationInput
                id="heartbeat-period"
                label="Expect a heartbeat every"
                seconds={interval}
                help="At least 30 seconds."
                onChange={setInterval}
              />
              <DurationInput
                id="heartbeat-grace"
                label="Grace period"
                seconds={grace}
                help="How long a late ping is tolerated before the heartbeat goes down."
                onChange={setGrace}
              />
              <MetadataPairs pairs={metadata} onChange={setMetadata} />
            </>
          )}
          <PolicySelect
            id="source-policy"
            workspaceId={workspaceId}
            value={policyId}
            onChange={setPolicyId}
          />
          <DrawerFooter>
            <Button
              type="submit"
              disabled={!name.trim() || create.isPending || (kind === "heartbeat" && interval < 30)}
            >
              {create.isPending && <Spinner />} Create
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
