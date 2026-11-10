import * as React from "react"

interface RowProps {
  children: React.ReactNode
}

export function Row({ children }: RowProps) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}
