import * as React from "react"
import { Eyebrow } from "@/components/ui"
import { cn } from "@/lib/utils"

type AuthFormAnchor = "center" | "top"

interface AuthFormCardProps {
  eyebrow?: string
  title: string
  subtitle: React.ReactNode
  anchor?: AuthFormAnchor
  children: React.ReactNode
}

const ANCHOR_CLASS: Record<AuthFormAnchor, string> = {
  center: "self-center",
  top: "self-start",
}

export function AuthFormCard({
  eyebrow,
  title,
  subtitle,
  anchor = "center",
  children,
}: AuthFormCardProps) {
  return (
    <div className={cn("grid w-full max-w-[25rem] gap-5", ANCHOR_CLASS[anchor])}>
      <div className="grid gap-1.5">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-heading text-[1.75rem] leading-[2.125rem] font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[0.8125rem] text-muted-foreground before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
      or
    </div>
  )
}
