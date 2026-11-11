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
} from "@/components/ui"
import { AGGS } from "../constants"
import type { MetricName, Widget } from "../schemas"

interface WidgetDialogProps {
  metrics: MetricName[]
  onAdd: (widget: Widget) => void
  pending: boolean
}

export function WidgetDialog({ metrics, onAdd, pending }: WidgetDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [metric, setMetric] = React.useState("")
  const [agg, setAgg] = React.useState<string>("avg")
  const [service, setService] = React.useState("")
  const [title, setTitle] = React.useState("")
  const chosen = metrics.find((item) => item.name === metric)
  const valid = Boolean(chosen)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!chosen) return
    onAdd({
      id: crypto.randomUUID().slice(0, 8),
      title: title.trim() || chosen.name,
      metric: chosen.name,
      agg,
      ...(service ? { service } : {}),
    })
    setOpen(false)
    setMetric("")
    setTitle("")
    setService("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" disabled={pending} />}>
        <Plus /> Add chart
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add a chart</DialogTitle>
            <DialogDescription>Pick a metric and how to summarise it over time.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Eyebrow>Metric</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {metrics.map((item) => (
                <Chip
                  key={item.name}
                  selected={metric === item.name}
                  onClick={() => {
                    setMetric(item.name)
                    setService("")
                    setAgg(item.kind === "counter" ? "rate" : "avg")
                  }}
                >
                  {item.name}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Eyebrow>Summarise as</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {AGGS.map((item) => (
                <Chip
                  key={item.value}
                  selected={agg === item.value}
                  onClick={() => setAgg(item.value)}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>
          {chosen && chosen.services.length > 1 && (
            <div className="grid gap-2">
              <Eyebrow>Service</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <Chip selected={service === ""} onClick={() => setService("")}>
                  All services
                </Chip>
                {chosen.services.map((name) => (
                  <Chip key={name} selected={service === name} onClick={() => setService(name)}>
                    {name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <Field label="Title (optional)" htmlFor="widget-title">
            <Input
              id="widget-title"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={chosen?.name ?? "CPU usage"}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={!valid}>
              Add chart
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
