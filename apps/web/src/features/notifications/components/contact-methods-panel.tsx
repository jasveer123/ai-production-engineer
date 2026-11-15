"use client"

import { Send } from "lucide-react"
import { Badge, Button, Spinner } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { useContactMethods, useRemoveContactMethod, useTestContactMethod } from "../hooks"
import { ContactMethodForm } from "./contact-method-form"
import { ProvidersNotice } from "./providers-notice"

interface ContactMethodsPanelProps {
  workspaceId: string
}

export function ContactMethodsPanel({ workspaceId }: ContactMethodsPanelProps) {
  const methods = useContactMethods(workspaceId)
  const remove = useRemoveContactMethod(workspaceId)
  const test = useTestContactMethod(workspaceId)
  const items = methods.data ?? []

  return (
    <div className="grid gap-4">
      <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
        Escalation steps reach you by e-mail at your account address. Add a phone number or push
        topic so steps that page by SMS, call or push can reach you too, and choose which severities
        each one is used for.
      </p>
      <ProvidersNotice workspaceId={workspaceId} />
      {methods.isPending ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="border border-dashed border-line p-6 text-center text-sm text-muted-foreground">
          No phone or push contact yet. SMS, call and push steps will be recorded as failed for you.
        </p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-line p-3"
            >
              <span className="flex flex-wrap items-center gap-2 text-sm">
                <Badge>{item.kind}</Badge>
                <span className="font-mono">{item.address}</span>
                <span className="text-muted-foreground">
                  {item.minSeverity === "low" ? "any severity" : `${item.minSeverity} and above`}
                </span>
              </span>
              <span className="flex gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={test.isPending}
                  onClick={() => test.mutate(item.id)}
                >
                  <Send /> Send test
                </Button>
                <ConfirmDialog
                  triggerLabel="Remove"
                  title="Remove this contact method?"
                  description="Escalations stop using it."
                  confirmLabel="Remove"
                  pending={remove.isPending}
                  onConfirm={() => remove.mutate(item.id)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      <ContactMethodForm workspaceId={workspaceId} />
    </div>
  )
}
