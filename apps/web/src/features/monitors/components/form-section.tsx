import * as React from "react"
import { ChevronDown } from "lucide-react"

interface FormSectionProps {
  title: string
  description: string
  collapsible?: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}

export function FormSection({
  title,
  description,
  collapsible,
  defaultOpen,
  children,
}: FormSectionProps) {
  const heading = (
    <div className="grid gap-1">
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      <p className="text-[0.8125rem] text-muted-foreground">{description}</p>
    </div>
  )
  if (!collapsible) {
    return (
      <section className="grid gap-5 border border-line bg-panel p-5 md:grid-cols-[16rem_1fr]">
        {heading}
        <div className="grid min-w-0 content-start gap-4">{children}</div>
      </section>
    )
  }
  return (
    <details open={defaultOpen} className="group border border-line bg-panel">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 outline-none focus-visible:ring-3 focus-visible:ring-brand/40">
        {heading}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-4 border-t border-line p-5 md:pl-[17.25rem]">{children}</div>
    </details>
  )
}
