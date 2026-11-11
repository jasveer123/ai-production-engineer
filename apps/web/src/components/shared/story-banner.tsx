import type { ReactNode } from "react"
import { AlertTriangleIcon, CheckCircle2Icon, CircleDashedIcon, XOctagonIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type StoryTone = "ok" | "warn" | "bad" | "idle"

interface StoryStat {
  label: string
  value: ReactNode
}

interface StoryBannerProps {
  tone: StoryTone
  headline: string
  detail?: string
  stats?: StoryStat[]
  action?: ReactNode
}

const TONE = {
  ok: { icon: CheckCircle2Icon, spine: "border-l-ok", text: "text-ok", wash: "bg-ok-soft/40" },
  warn: {
    icon: AlertTriangleIcon,
    spine: "border-l-warn",
    text: "text-warn",
    wash: "bg-warn-soft/40",
  },
  bad: {
    icon: XOctagonIcon,
    spine: "border-l-danger",
    text: "text-danger",
    wash: "bg-danger-soft/40",
  },
  idle: {
    icon: CircleDashedIcon,
    spine: "border-l-brand",
    text: "text-brand",
    wash: "bg-brand-soft/40",
  },
} as const

export function StoryBanner({ tone, headline, detail, stats, action }: StoryBannerProps) {
  const style = TONE[tone]
  const Icon = style.icon

  return (
    <section
      className={cn("grid gap-4 border border-l-4 border-line p-5 sm:p-6", style.spine, style.wash)}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className={cn("mt-1 size-6 shrink-0", style.text)} aria-hidden />
          <div className="grid min-w-0 gap-1">
            <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              {headline}
            </h2>
            {detail && <p className="max-w-prose text-sm text-muted-foreground">{detail}</p>}
          </div>
        </div>
        {action}
      </div>
      {stats && stats.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="grid gap-0.5">
              <dt className="font-mono text-[0.6875rem] tracking-wider text-muted-foreground uppercase">
                {stat.label}
              </dt>
              <dd className="font-heading text-lg font-semibold">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
