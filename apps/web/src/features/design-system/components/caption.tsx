import * as React from "react"
import { Eyebrow } from "@/components/ui"

interface CaptionProps {
  children: React.ReactNode
}

export function Caption({ children }: CaptionProps) {
  return <Eyebrow className="w-24 shrink-0">{children}</Eyebrow>
}
