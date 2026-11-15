"use client"

import * as React from "react"
import { Download, X } from "lucide-react"
import { Badge, Button, Eyebrow, Input, Spinner } from "@/components/ui"
import { STATUS_ENDPOINTS, apiUrl } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { SUBSCRIBER_TONE } from "../constants"
import { useDeliveries, useSubscriberActions, useSubscribers } from "../hooks"
import { DeliveryList } from "./delivery-list"

interface SubscribersTabProps {
  workspaceId: string
  pageId: string
  canManage: boolean
}

export function SubscribersTab({ workspaceId, pageId, canManage }: SubscribersTabProps) {
  const subscribers = useSubscribers(workspaceId, pageId)
  const deliveries = useDeliveries(workspaceId, pageId)
  const actions = useSubscriberActions(workspaceId, pageId)
  const [email, setEmail] = React.useState("")

  if (!canManage)
    return <p className="text-sm text-muted-foreground">Only admins can see subscribers.</p>

  const rows = subscribers.data ?? []

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <form
          method="post"
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (email.trim()) actions.add.mutate(email.trim(), { onSuccess: () => setEmail("") })
          }}
        >
          <Input
            type="email"
            aria-label="Subscriber email"
            className="w-64"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@company.com"
          />
          <Button type="submit" size="sm" disabled={!email.trim() || actions.add.isPending}>
            {actions.add.isPending && <Spinner />} Add subscriber
          </Button>
        </form>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          nativeButton={false}
          render={
            <a href={apiUrl(STATUS_ENDPOINTS.SUBSCRIBERS_CSV(workspaceId, pageId))} download />
          }
        >
          <Download /> Export CSV
        </Button>
      </div>
      <p className="text-[0.8125rem] text-muted-foreground">
        New subscribers get a confirmation email and start receiving updates once they confirm.
      </p>
      <section className="grid gap-2" aria-label="Subscribers">
        <Eyebrow>Subscribers ({rows.length})</Eyebrow>
        {subscribers.isPending && <Spinner className="size-5" />}
        {!subscribers.isPending && rows.length === 0 && (
          <p className="text-[0.8125rem] text-muted-foreground">Nobody has subscribed yet.</p>
        )}
        <ul className="grid divide-y divide-line border border-line">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem]">{s.email}</span>
              <Badge variant={SUBSCRIBER_TONE[s.state]}>{s.state}</Badge>
              <span className="text-[0.75rem] text-muted-foreground">
                {formatRelativeTime(s.createdAt)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${s.email}`}
                disabled={actions.remove.isPending}
                onClick={() => actions.remove.mutate(s.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <DeliveryList notices={deliveries.data ?? []} />
    </div>
  )
}
