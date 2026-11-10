import { cn } from "@/lib/utils"

interface SourceFieldProps {
  label: string
  children: React.ReactNode
  className?: string
}

export function SourceField({ label, children, className }: SourceFieldProps) {
  return (
    <div className={cn("grid min-w-0 gap-1", className)}>
      <dt className="font-mono text-[0.6875rem] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="truncate border border-line bg-sunken px-3 py-2 font-mono text-[0.8125rem]">
        {children}
      </dd>
    </div>
  )
}
