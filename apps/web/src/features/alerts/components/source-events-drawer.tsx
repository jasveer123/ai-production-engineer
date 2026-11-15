"use client"

import * as React from "react"
import { Inbox } from "lucide-react"
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Spinner,
} from "@/components/ui"
import { useReplayReceipt, useSourceReceipts } from "../hooks"
import type { AlertSource } from "../schemas"
import { ReceiptRow } from "./receipt-row"
import { RoutePreviewForm } from "./route-preview-form"

interface SourceEventsDrawerProps {
  workspaceId: string
  source: AlertSource
  canManage: boolean
}

export function SourceEventsDrawer({ workspaceId, source, canManage }: SourceEventsDrawerProps) {
  const [open, setOpen] = React.useState(false)
  const receipts = useSourceReceipts(workspaceId, source.id, open)
  const replay = useReplayReceipt(workspaceId, source.id)
  const items = receipts.data ?? []

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button variant="outline" size="xs" />}>
        <Inbox /> Events
      </DrawerTrigger>
      <DrawerContent>
        <div className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>Events from {source.name}</DrawerTitle>
            <DrawerDescription>
              Every delivery is stored before it is acknowledged. Repeats of the same event are
              counted, not processed twice.
            </DrawerDescription>
          </DrawerHeader>
          {canManage && <RoutePreviewForm workspaceId={workspaceId} sourceId={source.id} />}
          {receipts.isPending ? (
            <Spinner />
          ) : items.length === 0 ? (
            <p className="border border-dashed border-line p-6 text-center text-sm text-muted-foreground">
              Nothing received yet.
            </p>
          ) : (
            <ul className="grid gap-2">
              {items.map((receipt) => (
                <ReceiptRow
                  key={receipt.id}
                  receipt={receipt}
                  canReplay={canManage}
                  pending={replay.isPending}
                  onReplay={(id) => replay.mutate(id)}
                />
              ))}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
