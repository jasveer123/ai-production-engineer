"use client"

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Spinner,
} from "@/components/ui"
import { useLogContext } from "../hooks"
import type { LogLine } from "../schemas"
import { LogRow } from "./log-row"

interface LogContextDrawerProps {
  workspaceId: string
  line: LogLine | null
  onClose: () => void
}

export function LogContextDrawer({ workspaceId, line, onClose }: LogContextDrawerProps) {
  const { data, isPending } = useLogContext(workspaceId, line?.id ?? null)

  return (
    <Drawer open={Boolean(line)} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>Surrounding lines</DrawerTitle>
          <DrawerDescription>
            Up to 25 lines before and after, from {line?.service} in {line?.environment}.
          </DrawerDescription>
        </DrawerHeader>
        {isPending || !data ? (
          <Spinner />
        ) : (
          <ul className="divide-y divide-line border border-line bg-sunken">
            {data.before.map((item) => (
              <LogRow key={item.id} line={item} />
            ))}
            <LogRow line={data.anchor} highlight />
            {data.after.map((item) => (
              <LogRow key={item.id} line={item} />
            ))}
          </ul>
        )}
      </DrawerContent>
    </Drawer>
  )
}
