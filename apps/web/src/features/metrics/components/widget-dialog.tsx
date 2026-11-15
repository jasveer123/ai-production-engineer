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
} from "@/components/ui"
import { AGGS, CHARTS } from "../constants"
import { useMetricLabels } from "../hooks"
import type { ChartType, MetricName, Widget } from "../schemas"
import { ChoiceChips } from "./choice-chips"

interface WidgetDialogProps {
  workspaceId: string
  metrics: MetricName[]
  onAdd: (widget: Widget) => void
  pending: boolean
}

export function WidgetDialog({ workspaceId, metrics, onAdd, pending }: WidgetDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [metric, setMetric] = React.useState("")
  const [agg, setAgg] = React.useState<string>("avg")
  const [service, setService] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [chart, setChart] = React.useState<ChartType>("line")
  const [groupBy, setGroupBy] = React.useState("")
  const [filter, setFilter] = React.useState<{ key: string; value: string } | null>(null)
  const chosen = metrics.find((item) => item.name === metric)
  const labels = useMetricLabels(workspaceId, metric)
  const valid = Boolean(chosen)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!chosen) return
    onAdd({
      id: crypto.randomUUID().slice(0, 8),
      title: title.trim() || chosen.name,
      metric: chosen.name,
      agg,
      chart,
      ...(service ? { service } : {}),
      ...(groupBy ? { groupBy } : {}),
      ...(filter ? { filters: `${filter.key}=${filter.value}` } : {}),
    })
    setOpen(false)
    setMetric("")
    setTitle("")
    setService("")
    setGroupBy("")
    setFilter(null)
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button size="sm" disabled={pending} />}>
        <Plus /> Add chart
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>Add a chart</DrawerTitle>
            <DrawerDescription>Pick a metric and how to summarise it over time.</DrawerDescription>
          </DrawerHeader>
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
                    setGroupBy("")
                    setFilter(null)
                    setAgg(
                      item.kind === "counter" ? "rate" : item.kind === "histogram" ? "p95" : "avg"
                    )
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
          <ChoiceChips
            label="Show as"
            options={CHARTS}
            value={chart}
            onChange={(value) => setChart(value as ChartType)}
          />
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
          {chosen && (
            <div className="grid gap-2">
              <Eyebrow>Split into lines by</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <Chip selected={groupBy === ""} onClick={() => setGroupBy("")}>
                  One line
                </Chip>
                {["service", ...(labels.data ?? []).map((l) => l.key)].map((key) => (
                  <Chip key={key} selected={groupBy === key} onClick={() => setGroupBy(key)}>
                    {key}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {(labels.data ?? []).length > 0 && (
            <div className="grid gap-2">
              <Eyebrow>Only where</Eyebrow>
              <div className="flex flex-wrap gap-2">
                {(labels.data ?? []).flatMap((l) =>
                  l.values.map((value) => (
                    <Chip
                      key={`${l.key}=${value}`}
                      selected={filter?.key === l.key && filter.value === value}
                      onClick={() =>
                        setFilter(
                          filter?.key === l.key && filter.value === value
                            ? null
                            : { key: l.key, value }
                        )
                      }
                    >
                      {l.key}={value}
                    </Chip>
                  ))
                )}
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
          <DrawerFooter>
            <Button type="submit" disabled={!valid}>
              Add chart
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
