"use client"

import * as React from "react"
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
} from "@/components/ui"
import { DEFAULT_CURRENCY } from "../constants"
import { useSetServiceValue } from "../hooks"
import type { ServiceRowData } from "../lib"

interface SetValueDialogProps {
  workspaceId: string
  row: ServiceRowData
}

export function SetValueDialog({ workspaceId, row }: SetValueDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(row.valuePerRequest?.toString() ?? "")
  const [currency, setCurrency] = React.useState(row.currency ?? DEFAULT_CURRENCY)
  const save = useSetServiceValue(workspaceId)
  const parsed = Number(value)
  const valid = Number.isFinite(parsed) && parsed > 0

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    save.mutate(
      {
        name: row.name,
        environment: row.environment,
        serviceId: row.serviceId,
        valuePerRequest: parsed,
        currency: currency.trim().toUpperCase(),
      },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button variant="ghost" size="xs" className="text-brand" />}>
        {row.valuePerRequest === null ? "Set value" : "Edit"}
      </DrawerTrigger>
      <DrawerContent>
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>Business value of {row.name}</DrawerTitle>
            <DrawerDescription>
              What one successful request is worth to you. Pramaan multiplies it by the failed
              requests to show what a problem costs.
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Field label="Value per request" htmlFor="service-value">
              <Input
                id="service-value"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="0.50"
              />
            </Field>
            <Field label="Currency" htmlFor="service-currency">
              <Input
                id="service-currency"
                maxLength={3}
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              />
            </Field>
          </div>
          <DrawerFooter>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending && <Spinner />} Save value
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
