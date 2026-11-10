import { KeyRound } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui"
import { CopyButton } from "./copy-button"

interface TokenSecretNoticeProps {
  token: string
}

export function TokenSecretNotice({ token }: TokenSecretNoticeProps) {
  return (
    <Alert variant="warning">
      <KeyRound />
      <AlertTitle>Copy your token now</AlertTitle>
      <AlertDescription>
        <span className="block pb-2">
          For safety we only show it once. The snippets below already use it.
        </span>
        <span className="flex items-center justify-between gap-2 border border-line bg-sunken py-1 pr-1 pl-3 font-mono text-[0.75rem] text-text">
          <span className="min-w-0 truncate">{token}</span>
          <CopyButton text={token} label="Copy token" />
        </span>
      </AlertDescription>
    </Alert>
  )
}
