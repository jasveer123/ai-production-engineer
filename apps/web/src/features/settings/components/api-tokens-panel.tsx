"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import {
  Button,
  Chip,
  CodeBlock,
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
  Spinner,
} from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from "../hooks"

const EXPIRIES = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
] as const

export function ApiTokensPanel() {
  const tokens = useApiTokens()
  const create = useCreateApiToken()
  const revoke = useRevokeApiToken()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [days, setDays] = React.useState<number>(90)
  const [secret, setSecret] = React.useState<string | null>(null)

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setSecret(null)
      setName("")
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
          Personal tokens let your scripts call the API as you, with your role in each workspace.
          Send one as <span className="font-mono">Authorization: Bearer &lt;token&gt;</span>.
        </p>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerTrigger render={<Button size="sm" />}>
            <Plus /> New token
          </DrawerTrigger>
          <DrawerContent>
            {secret ? (
              <div className="grid gap-4">
                <DrawerHeader>
                  <DrawerTitle>Copy your token now</DrawerTitle>
                  <DrawerDescription>
                    It is shown only once. Store it somewhere safe.
                  </DrawerDescription>
                </DrawerHeader>
                <CodeBlock>{secret}</CodeBlock>
                <DrawerFooter>
                  <Button onClick={() => onOpenChange(false)}>Done</Button>
                </DrawerFooter>
              </div>
            ) : (
              <form
                method="post"
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (name.trim())
                    create.mutate(
                      { name: name.trim(), expiresInDays: days },
                      { onSuccess: (result) => setSecret(result.token) }
                    )
                }}
              >
                <DrawerHeader>
                  <DrawerTitle>New API token</DrawerTitle>
                  <DrawerDescription>Name it after the script that will use it.</DrawerDescription>
                </DrawerHeader>
                <Field label="Name" htmlFor="token-name">
                  <Input
                    id="token-name"
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Deploy script"
                  />
                </Field>
                <div className="grid gap-2">
                  <Eyebrow>Expires after</Eyebrow>
                  <div className="flex flex-wrap gap-2">
                    {EXPIRIES.map((item) => (
                      <Chip
                        key={item.days}
                        selected={days === item.days}
                        onClick={() => setDays(item.days)}
                      >
                        {item.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <DrawerFooter>
                  <Button type="submit" disabled={!name.trim() || create.isPending}>
                    {create.isPending && <Spinner />} Create token
                  </Button>
                </DrawerFooter>
              </form>
            )}
          </DrawerContent>
        </Drawer>
      </div>
      <ul className="grid gap-2">
        {(tokens.data ?? []).map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 border border-line bg-panel p-3 text-sm"
          >
            <span>
              <span className="font-medium">{item.name}</span>{" "}
              <span className="font-mono text-[0.75rem] text-muted-foreground">{item.prefix}…</span>
              <span className="block text-[0.75rem] text-muted-foreground">
                {item.lastUsedAt ? `used ${formatRelativeTime(item.lastUsedAt)}` : "never used"} ·{" "}
                {item.expiresAt ? `expires ${formatRelativeTime(item.expiresAt)}` : "no expiry"}
              </span>
            </span>
            <ConfirmDialog
              triggerLabel="Revoke"
              title={`Revoke ${item.name}?`}
              description="Scripts using this token stop working straight away."
              confirmLabel="Revoke token"
              pending={revoke.isPending}
              onConfirm={() => revoke.mutate(item.id)}
            />
          </li>
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
