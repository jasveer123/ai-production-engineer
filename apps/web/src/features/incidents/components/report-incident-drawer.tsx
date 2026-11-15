"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
  Field,
  Input,
  Spinner,
  Textarea,
} from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { SEVERITIES } from "../constants"
import { usePolicyOptions, useReportIncident } from "../hooks"
import type { ReportIncidentRequest } from "../response-schemas"
import { OptionSelect } from "./option-select"

interface ReportIncidentDrawerProps {
  workspaceId: string
  monitors: Record<string, string>
}

const NOTIFY = {
  none: "Nobody yet",
  policy: "An escalation policy",
  team: "The whole team",
} as const

export function ReportIncidentDrawer({ workspaceId, monitors }: ReportIncidentDrawerProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [cause, setCause] = React.useState("")
  const [severity, setSeverity] = React.useState("high")
  const [monitorId, setMonitorId] = React.useState("")
  const [notify, setNotify] = React.useState<ReportIncidentRequest["notify"]>("team")
  const [policyId, setPolicyId] = React.useState("")
  const policies = usePolicyOptions(workspaceId)
  const report = useReportIncident(workspaceId)
  const policyOptions = Object.fromEntries((policies.data ?? []).map((p) => [p.id, p.name]))
  const valid = title.trim().length >= 3 && (notify !== "policy" || policyId)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    report.mutate(
      {
        title: title.trim(),
        severity,
        notify,
        ...(cause.trim() ? { description: cause.trim() } : {}),
        ...(monitorId ? { monitorId } : {}),
        ...(notify === "policy" ? { policyId } : {}),
      },
      {
        onSuccess: (incident) => {
          setOpen(false)
          router.push(ROUTES.incidentDetail(incident.id))
        },
      }
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button size="sm" />}>
        <Plus /> Report a new incident
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>Report a new incident</DrawerTitle>
            <DrawerDescription>
              Open an incident by hand and decide who hears about it.
            </DrawerDescription>
          </DrawerHeader>
          <Field label="Name" htmlFor="report-title">
            <Input
              id="report-title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Checkout is failing for card payments"
            />
          </Field>
          <Field label="Cause or summary" htmlFor="report-cause">
            <Textarea
              id="report-cause"
              value={cause}
              maxLength={5000}
              onChange={(e) => setCause(e.target.value)}
              placeholder="What is broken and who is affected"
            />
          </Field>
          <Field label="Severity">
            <div className="flex flex-wrap gap-2">
              {SEVERITIES.map((item) => (
                <Chip key={item} selected={severity === item} onClick={() => setSeverity(item)}>
                  {item}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Monitor (optional)" htmlFor="report-monitor">
            <OptionSelect
              id="report-monitor"
              label="Monitor"
              value={monitorId}
              options={monitors}
              anyLabel="No monitor"
              onChange={setMonitorId}
            />
          </Field>
          <Field label="Who to notify">
            <div className="flex flex-wrap gap-2">
              {Object.entries(NOTIFY).map(([value, label]) => (
                <Chip
                  key={value}
                  selected={notify === value}
                  onClick={() => setNotify(value as ReportIncidentRequest["notify"])}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </Field>
          {notify === "policy" && (
            <Field label="Escalation policy" htmlFor="report-policy">
              <OptionSelect
                id="report-policy"
                label="Escalation policy"
                value={policyId}
                options={policyOptions}
                onChange={setPolicyId}
              />
            </Field>
          )}
          <DrawerFooter>
            <Button type="submit" disabled={!valid || report.isPending}>
              {report.isPending && <Spinner />} Report incident
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
