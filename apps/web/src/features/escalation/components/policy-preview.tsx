"use client"

import * as React from "react"
import { Users } from "lucide-react"
import {
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Eyebrow,
  Spinner,
} from "@/components/ui"
import { usePolicyPreview } from "../hooks"

interface PolicyPreviewProps {
  workspaceId: string
  policyId: string
  policyName: string
}

export function PolicyPreview({ workspaceId, policyId, policyName }: PolicyPreviewProps) {
  const [open, setOpen] = React.useState(false)
  const preview = usePolicyPreview(workspaceId, policyId, open)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button size="xs" variant="outline" />}>
        <Users /> Who gets notified
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>{policyName}: who would be notified now</DrawerTitle>
          <DrawerDescription>
            Resolved right now, using current on-call schedules and each person&apos;s contact
            methods.
          </DrawerDescription>
        </DrawerHeader>
        {preview.isPending ? (
          <Spinner />
        ) : (
          <div className="grid gap-5">
            {(preview.data ?? []).map((variant) => (
              <section key={variant.branch ?? "main"} className="grid gap-3">
                <Eyebrow>{variant.branch ? `Branch: ${variant.branch}` : "Main steps"}</Eyebrow>
                {variant.steps.map((step, index) => (
                  <div key={index} className="grid gap-2 border border-line p-3">
                    <span className="font-mono text-[0.75rem] text-muted-foreground">
                      Step {index + 1} ·{" "}
                      {index === 0 ? "immediately" : `after ${step.waitMinutes} min`}
                    </span>
                    {step.recipients.length === 0 && (
                      <span className="text-sm text-danger">Nobody would be notified.</span>
                    )}
                    <ul className="grid gap-1">
                      {step.recipients.map((r, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge>{r.channel}</Badge>
                          <span>{r.name}</span>
                          <span className="font-mono text-[0.75rem] text-muted-foreground">
                            {r.address}
                          </span>
                          {r.problem && (
                            <span className="text-[0.75rem] text-danger">{r.problem}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
