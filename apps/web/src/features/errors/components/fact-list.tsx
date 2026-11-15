import { Eyebrow } from "@/components/ui"

interface FactListProps {
  title: string
  rows: [string, string][]
}

export function FactList({ title, rows }: FactListProps) {
  if (rows.length === 0) return null
  return (
    <section className="grid content-start gap-2" aria-label={title}>
      <Eyebrow>{title}</Eyebrow>
      <dl className="grid gap-px border border-line text-[0.8125rem]">
        {rows.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[minmax(6rem,40%)_1fr] gap-3 px-3 py-1.5">
            <dt className="truncate text-muted-foreground">{key}</dt>
            <dd className="min-w-0 truncate font-mono text-[0.75rem]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
