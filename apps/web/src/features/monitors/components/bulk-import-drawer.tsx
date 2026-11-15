"use client"

import * as React from "react"
import { Upload } from "lucide-react"
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
  Spinner,
  Textarea,
} from "@/components/ui"
import { INTERVALS } from "../constants"
import { useBulkCreateMonitors } from "../hooks"
import type { BulkResult } from "../schemas"
import { FormSelect } from "./form-select"

interface BulkImportDrawerProps {
  workspaceId: string
}

export function BulkImportDrawer({ workspaceId }: BulkImportDrawerProps) {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState("")
  const [interval, setIntervalSeconds] = React.useState(180)
  const [result, setResult] = React.useState<BulkResult | null>(null)
  const bulk = useBulkCreateMonitors(workspaceId)
  const urls = text
    .split(/\s+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!urls.length) return
    bulk.mutate(
      { urls: urls.slice(0, 100), intervalSeconds: interval },
      {
        onSuccess: (data) => {
          setResult(data)
          setText(data.failed.map((f) => f.url).join("\n"))
        },
      }
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button size="sm" variant="outline" />}>
        <Upload /> Import URLs
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>Import many URLs</DrawerTitle>
            <DrawerDescription>
              Paste one address per line. Each becomes a monitor that alerts when the URL is
              unavailable. Up to 100 at a time.
            </DrawerDescription>
          </DrawerHeader>
          <Field label="URLs" htmlFor="bulk-urls" help={`${urls.length} found`}>
            <Textarea
              id="bulk-urls"
              rows={8}
              className="font-mono"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"https://example.com\nhttps://api.example.com/health"}
            />
          </Field>
          <FormSelect
            id="bulk-interval"
            label="Check frequency"
            value={interval}
            onChange={(e) => setIntervalSeconds(Number(e.target.value))}
            options={INTERVALS.map((i) => ({ value: i.seconds, label: i.label }))}
          />
          {result && (
            <div className="grid gap-1 text-sm">
              <p>Created {result.created.length} monitors.</p>
              {result.failed.map((f) => (
                <p key={f.url} className="text-danger">
                  {f.url}: {f.message}
                </p>
              ))}
            </div>
          )}
          <DrawerFooter>
            <Button type="submit" disabled={!urls.length || bulk.isPending}>
              {bulk.isPending && <Spinner />} Create {urls.length || ""} monitors
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
