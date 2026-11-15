interface FactRowProps {
  label: string
  children: React.ReactNode
}

export function FactRow({ label, children }: FactRowProps) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}
