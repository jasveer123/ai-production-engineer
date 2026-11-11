"use client"

import { ConfirmDialog } from "@/components/shared"

interface RevokeTokenDialogProps {
  tokenName: string
  pending: boolean
  onConfirm: () => void
}

export function RevokeTokenDialog({ tokenName, pending, onConfirm }: RevokeTokenDialogProps) {
  return (
    <ConfirmDialog
      triggerLabel="Revoke"
      title={`Revoke ${tokenName}?`}
      description="Anything still using this token stops sending data within a minute. This cannot be undone."
      confirmLabel="Revoke token"
      pending={pending}
      onConfirm={onConfirm}
    />
  )
}
