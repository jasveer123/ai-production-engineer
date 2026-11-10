"use client"

import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui"
import { useCopy } from "@/lib/hooks/use-copy"

interface CopyButtonProps {
  text: string
  label: string
}

export function CopyButton({ text, label }: CopyButtonProps) {
  const { copied, copy } = useCopy()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={copied ? "Copied" : label}
      onClick={() => copy(text)}
    >
      {copied ? <Check className="text-ok" /> : <Copy />}
    </Button>
  )
}
