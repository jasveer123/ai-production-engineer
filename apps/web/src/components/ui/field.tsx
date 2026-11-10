import * as React from "react"
import { cn } from "@/lib/utils"

interface FieldProps {
  label: string
  htmlFor?: string
  help?: string
  error?: string
  className?: string
  children: React.ReactNode
}

export function Field({ label, htmlFor, help, error, className, children }: FieldProps) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[0.8125rem] leading-5 font-medium text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[0.8125rem] text-danger">{error}</p>
      ) : help ? (
        <p className="text-[0.8125rem] text-muted-foreground">{help}</p>
      ) : null}
    </div>
  )
}
