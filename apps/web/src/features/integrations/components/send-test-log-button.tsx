"use client"

import { Send } from "lucide-react"
import { Button, Spinner } from "@/components/ui"
import { useSendTestLog } from "../hooks"

interface SendTestLogButtonProps {
  workspaceId: string
  token: string | null
}

export function SendTestLogButton({ workspaceId, token }: SendTestLogButtonProps) {
  const send = useSendTestLog(workspaceId)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={!token || send.isPending}
        onClick={() => token && send.mutate({ token })}
      >
        {send.isPending ? <Spinner /> : <Send />} Send a test log
      </Button>
      {!token && (
        <span className="text-[0.8125rem] text-muted-foreground">
          Create or rotate a token above to enable this.
        </span>
      )}
    </div>
  )
}
