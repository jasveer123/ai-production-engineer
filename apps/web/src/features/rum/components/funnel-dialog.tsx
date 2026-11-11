"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
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
import { useCreateFunnel, useRumApps } from "../hooks"
import type { FunnelStep } from "../schemas"

interface FunnelDialogProps {
  workspaceId: string
}

export function FunnelDialog({ workspaceId }: FunnelDialogProps) {
  const apps = useRumApps(workspaceId)
  const create = useCreateFunnel(workspaceId)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [appId, setAppId] = React.useState("")
  const [steps, setSteps] = React.useState<FunnelStep[]>([
    { kind: "pageview", match: "" },
    { kind: "event", match: "" },
  ])
  const app = appId || apps.data?.[0]?.id || ""
  const valid = name.trim() && app && steps.every((s) => s.match.trim())

  const patch = (index: number, change: Partial<FunnelStep>) =>
    setSteps((list) => list.map((s, i) => (i === index ? { ...s, ...change } : s)))

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button size="sm" />}>
        <Plus /> New funnel
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <form
          method="post"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!valid) return
            create.mutate(
              {
                appId: app,
                name: name.trim(),
                steps: steps.map((s) => ({ ...s, match: s.match.trim() })),
              },
              { onSuccess: () => setOpen(false) }
            )
          }}
        >
          <DrawerHeader>
            <DrawerTitle>New funnel</DrawerTitle>
            <DrawerDescription>
              See how many sessions get from the first step to the last, in order.
            </DrawerDescription>
          </DrawerHeader>
          <Field label="Name" htmlFor="funnel-name">
            <Input
              id="funnel-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Signup to purchase"
            />
          </Field>
          {(apps.data ?? []).length > 1 && (
            <div className="flex flex-wrap gap-2">
              {(apps.data ?? []).map((a) => (
                <Chip key={a.id} selected={app === a.id} onClick={() => setAppId(a.id)}>
                  {a.name}
                </Chip>
              ))}
            </div>
          )}
          {steps.map((step, index) => (
            <div key={index} className="grid gap-2 border border-line p-3">
              <div className="flex items-center justify-between">
                <Eyebrow>Step {index + 1}</Eyebrow>
                {steps.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove step ${index + 1}`}
                    onClick={() => setSteps((l) => l.filter((_, i) => i !== index))}
                  >
                    <X />
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Chip
                  selected={step.kind === "pageview"}
                  onClick={() => patch(index, { kind: "pageview" })}
                >
                  Visits a page
                </Chip>
                <Chip
                  selected={step.kind === "event"}
                  onClick={() => patch(index, { kind: "event" })}
                >
                  Does something
                </Chip>
              </div>
              <Input
                aria-label={`Step ${index + 1} match`}
                value={step.match}
                onChange={(e) => patch(index, { match: e.target.value })}
                placeholder={step.kind === "pageview" ? "/pricing or /checkout/*" : "add_to_cart"}
              />
            </div>
          ))}
          {steps.length < 6 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSteps((l) => [...l, { kind: "event", match: "" }])}
            >
              <Plus /> Add step
            </Button>
          )}
          <DrawerFooter>
            <Button type="submit" disabled={!valid || create.isPending}>
              {create.isPending && <Spinner />} Create funnel
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
