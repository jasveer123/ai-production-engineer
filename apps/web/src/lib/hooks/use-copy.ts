import * as React from "react"
import { notifyError } from "@/lib/toast"

const COPIED_RESET_MS = 2_000
const COPY_FAILED = "Could not copy. Select the text and copy it by hand."

export function useCopy() {
  const [copied, setCopied] = React.useState(false)

  const copy = React.useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_RESET_MS)
    } catch {
      notifyError(new Error(COPY_FAILED))
    }
  }, [])

  return { copied, copy }
}
