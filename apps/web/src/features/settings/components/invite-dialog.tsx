"use client"

import * as React from "react"
import { UserPlus } from "lucide-react"
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
import { ROLES, ROLE_HELP } from "../constants"
import { useInvite } from "../hooks"

interface InviteDialogProps {
  workspaceId: string
}

export function InviteDialog({ workspaceId }: InviteDialogProps) {
  const invite = useInvite(workspaceId)
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<string>("engineer")
  const [link, setLink] = React.useState<string | null>(null)

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setLink(null)
      setEmail("")
    }
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return
    invite.mutate(
      { email: email.trim(), role },
      { onSuccess: (result) => setLink(result.inviteUrl) }
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger render={<Button size="sm" />}>
        <UserPlus /> Invite
      </DrawerTrigger>
      <DrawerContent>
        {link ? (
          <div className="grid gap-4">
            <DrawerHeader>
              <DrawerTitle>Invitation created</DrawerTitle>
              <DrawerDescription>
                Send this link to {email}. It is shown only now, and works when they sign in with
                that email.
              </DrawerDescription>
            </DrawerHeader>
            <CodeBlock>{link}</CodeBlock>
            <DrawerFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DrawerFooter>
          </div>
        ) : (
          <form method="post" onSubmit={onSubmit} className="grid gap-4">
            <DrawerHeader>
              <DrawerTitle>Invite a teammate</DrawerTitle>
              <DrawerDescription>They join with the role you choose.</DrawerDescription>
            </DrawerHeader>
            <Field label="Email" htmlFor="invite-email">
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </Field>
            <div className="grid gap-2">
              <Eyebrow>Role</Eyebrow>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((item) => (
                  <Chip key={item} selected={role === item} onClick={() => setRole(item)}>
                    {item}
                  </Chip>
                ))}
              </div>
              <p className="text-[0.8125rem] text-muted-foreground">{ROLE_HELP[role]}</p>
            </div>
            <DrawerFooter>
              <Button type="submit" disabled={!email.trim() || invite.isPending}>
                {invite.isPending && <Spinner />} Create invitation
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
