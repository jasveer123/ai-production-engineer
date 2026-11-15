"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { Button, Chip, Field, Input, Spinner } from "@/components/ui"
import { CONTACT_KINDS, MIN_SEVERITIES } from "../constants"
import { useAddContactMethod } from "../hooks"

interface ContactMethodFormProps {
  workspaceId: string
}

export function ContactMethodForm({ workspaceId }: ContactMethodFormProps) {
  const add = useAddContactMethod(workspaceId)
  const [kind, setKind] = React.useState<string>("sms")
  const [address, setAddress] = React.useState("")
  const [minSeverity, setMinSeverity] = React.useState("low")
  const current = CONTACT_KINDS.find((item) => item.value === kind) ?? CONTACT_KINDS[0]

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!address.trim()) return
    add.mutate({ kind, address: address.trim(), minSeverity }, { onSuccess: () => setAddress("") })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 border border-line p-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Contact method">
        {CONTACT_KINDS.map((item) => (
          <Chip key={item.value} selected={kind === item.value} onClick={() => setKind(item.value)}>
            {item.label}
          </Chip>
        ))}
      </div>
      <Field label={kind === "push" ? "Topic URL" : "Phone number"} htmlFor="contact-address">
        <Input
          id="contact-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={current.placeholder}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Use for">
        <span className="text-[0.8125rem] text-muted-foreground">Use for</span>
        {MIN_SEVERITIES.map((item) => (
          <Chip key={item} selected={minSeverity === item} onClick={() => setMinSeverity(item)}>
            {item === "low" ? "Any severity" : `${item} and above`}
          </Chip>
        ))}
      </div>
      <div>
        <Button type="submit" size="sm" disabled={!address.trim() || add.isPending}>
          {add.isPending ? <Spinner /> : <Plus />} Add contact method
        </Button>
      </div>
    </form>
  )
}
