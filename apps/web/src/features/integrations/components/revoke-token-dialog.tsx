"use client"

import { Button } from "@/components/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui"

interface RevokeTokenDialogProps {
  tokenName: string
  pending: boolean
  onConfirm: () => void
}

export function RevokeTokenDialog({ tokenName, pending, onConfirm }: RevokeTokenDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" size="xs" disabled={pending} />}>
        Revoke
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke {tokenName}?</DialogTitle>
          <DialogDescription>
            Anything still using this token stops sending data within a minute. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" onClick={onConfirm}>
            Revoke token
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
