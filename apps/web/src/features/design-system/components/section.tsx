import * as React from "react"
import { Eyebrow } from "@/components/ui"

interface SectionProps {
  id: string
  title: string
  note?: string
  children: React.ReactNode
}

export function Section({ id, title, note, children }: SectionProps) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-4">
      <div className="grid gap-1">
        <Eyebrow>{id}</Eyebrow>
        <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
        {note && <p className="text-[0.8125rem] text-muted-foreground">{note}</p>}
      </div>
      <div className="grid gap-5 border border-line bg-panel p-6">{children}</div>
    </section>
  )
}
