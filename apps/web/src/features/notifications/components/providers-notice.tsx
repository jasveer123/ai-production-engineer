"use client"

import { Badge } from "@/components/ui"
import { useProviders } from "../hooks"

interface ProvidersNoticeProps {
  workspaceId: string
}

export function ProvidersNotice({ workspaceId }: ProvidersNoticeProps) {
  const providers = useProviders(workspaceId)
  if (!providers.data) return null
  const { email, twilio } = providers.data

  return (
    <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted-foreground">
      <span>Delivery providers on this deployment:</span>
      <Badge variant={email ? "success" : "warning"}>
        E-mail {email ? "configured" : "not configured"}
      </Badge>
      <Badge variant={twilio ? "success" : "warning"}>
        SMS and calls {twilio ? "configured" : "not configured"}
      </Badge>
      {(!email || !twilio) && (
        <span>
          Messages to a channel that is not configured are recorded as failed, never sent.
        </span>
      )}
    </div>
  )
}
