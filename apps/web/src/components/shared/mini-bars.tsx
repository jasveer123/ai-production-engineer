import { cn } from "@/lib/utils"

interface MiniBarsProps {
  values: number[]
  tone?: "brand" | "danger"
}

export function MiniBars({ values, tone = "brand" }: MiniBarsProps) {
  const max = Math.max(1, ...values)

  return (
    <span className="flex h-7 w-20 items-end gap-px" aria-hidden>
      {values.map((value, index) => (
        <span
          key={index}
          className={cn("block flex-1", tone === "danger" ? "bg-danger/70" : "bg-brand/60")}
          style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
        />
      ))}
    </span>
  )
}
