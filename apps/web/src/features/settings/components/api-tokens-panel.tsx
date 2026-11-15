"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import {
  Button,
  CodeBlock,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui"
import { useApiTokens, useRevokeApiToken } from "../hooks"
import { ApiTokenForm } from "./api-token-form"
import { ApiTokenRow } from "./api-token-row"

interface ApiTokensPanelProps {
  workspaceId: string
  workspaceName: string
}

export function ApiTokensPanel({ workspaceId, workspaceName }: ApiTokensPanelProps) {
  const tokens = useApiTokens()
  const revoke = useRevokeApiToken()
  const [open, setOpen] = React.useState(false)
  const [secret, setSecret] = React.useState<string | null>(null)

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setSecret(null)
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
          A token works only in {workspaceName}, only for the scopes you pick, and your membership
          is checked on every call. Use it on the public API under{" "}
          <span className="font-mono">/api/v1/workspaces/{workspaceId}</span> with{" "}
          <span className="font-mono">Authorization: Bearer &lt;token&gt;</span>. The reference is
          at <span className="font-mono">/docs</span> on the API host.
        </p>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerTrigger render={<Button size="sm" />}>
            <Plus /> New token
          </DrawerTrigger>
          <DrawerContent>
            <div className="grid gap-4">
              <DrawerHeader>
                <DrawerTitle>{secret ? "Copy your token now" : "New API token"}</DrawerTitle>
                <DrawerDescription>
                  {secret
                    ? "It is shown only once. Store it somewhere safe."
                    : "Name it after the script that will use it."}
                </DrawerDescription>
              </DrawerHeader>
              {secret ? (
                <>
                  <CodeBlock>{secret}</CodeBlock>
                  <DrawerFooter>
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                  </DrawerFooter>
                </>
              ) : (
                <ApiTokenForm workspaceId={workspaceId} onCreated={setSecret} />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
      <ul className="grid gap-2">
        {(tokens.data ?? []).map((item) => (
          <ApiTokenRow
            key={item.id}
            token={item}
            workspaceName={item.workspaceId === workspaceId ? workspaceName : null}
            pending={revoke.isPending}
            onRevoke={(id) => revoke.mutate(id)}
          />
        ))}
        {tokens.data?.length === 0 && (
          <li className="border border-dashed border-line p-6 text-center text-sm text-muted-foreground">
            No tokens yet.
          </li>
        )}
      </ul>
    </div>
  )
}
