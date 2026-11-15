"use client"

import * as React from "react"
import { Chip, Eyebrow } from "@/components/ui"
import type { ErrorException } from "../schemas"
import { StackFrame } from "./stack-frame"

interface ExceptionChainProps {
  exceptions: ErrorException[]
}

export function ExceptionChain({ exceptions }: ExceptionChainProps) {
  const [all, setAll] = React.useState(false)
  const ordered = [...exceptions].reverse()

  return (
    <section className="grid gap-3" aria-label="Exceptions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>
          {ordered.length > 1 ? `Exception chain (${ordered.length})` : "Exception"}
        </Eyebrow>
        <Chip selected={all} onClick={() => setAll((v) => !v)}>
          Show library frames
        </Chip>
      </div>
      {ordered.map((exception, index) => {
        const frames = [...exception.frames].reverse()
        const shown = all || !frames.some((f) => f.inApp) ? frames : frames.filter((f) => f.inApp)
        return (
          <div key={index} className="grid gap-2">
            <p className="text-sm">
              {index > 0 && <span className="text-muted-foreground">Caused by </span>}
              <span className="font-semibold">{exception.type}</span>: {exception.value}
            </p>
            {shown.length > 0 ? (
              <ul className="grid gap-1">
                {shown.map((frame, i) => (
                  <StackFrame key={i} frame={frame} />
                ))}
              </ul>
            ) : (
              <p className="text-[0.8125rem] text-muted-foreground">No stack frames were sent.</p>
            )}
          </div>
        )
      })}
    </section>
  )
}
