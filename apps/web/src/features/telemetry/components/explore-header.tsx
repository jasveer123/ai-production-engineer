"use client"

import { useRouter } from "next/navigation"
import { Chip } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"

interface ExploreHeaderProps {
  active: "logs" | "traces" | "tail"
  title: string
}

const TABS = [
  { id: "logs", label: "Logs", href: ROUTES.exploreLogs },
  { id: "traces", label: "Traces", href: ROUTES.exploreTraces },
  { id: "tail", label: "Live tail", href: ROUTES.liveTail },
] as const

export function ExploreHeader({ active, title }: ExploreHeaderProps) {
  const router = useRouter()

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
      <nav aria-label="Explore" className="flex gap-2">
        {TABS.map((tab) => (
          <Chip key={tab.id} selected={active === tab.id} onClick={() => router.push(tab.href)}>
            {tab.label}
          </Chip>
        ))}
      </nav>
    </div>
  )
}
