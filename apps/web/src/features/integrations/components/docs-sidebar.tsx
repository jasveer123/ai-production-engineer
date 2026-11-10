"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Radar } from "lucide-react"
import { Eyebrow } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { cn } from "@/lib/utils"
import { INTEGRATIONS } from "../catalog"
import { COLLECTOR } from "../constants"

export function DocsSidebar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Integration guides"
      className="sticky top-24 hidden max-h-[calc(100vh-7rem)] w-60 shrink-0 gap-1 self-start overflow-y-auto lg:grid"
    >
      <Eyebrow className="px-3 pb-2">Collector</Eyebrow>
      <Link
        href={ROUTES.collectorDocs()}
        aria-current={pathname === ROUTES.collectorDocs() ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground outline-none hover:bg-panel-2 hover:text-text focus-visible:ring-3 focus-visible:ring-brand/40",
          pathname === ROUTES.collectorDocs() &&
            "border-brand bg-brand-soft font-medium text-brand-strong"
        )}
      >
        <Radar className="size-4" />
        {COLLECTOR.NAME}
      </Link>
      <Eyebrow className="px-3 pt-4 pb-2">Integration guides</Eyebrow>
      {INTEGRATIONS.map((item) => {
        const href = ROUTES.integrationDocs(item.id)
        const active = pathname === href

        return (
          <Link
            key={item.id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground outline-none hover:bg-panel-2 hover:text-text focus-visible:ring-3 focus-visible:ring-brand/40",
              active && "border-brand bg-brand-soft font-medium text-brand-strong"
            )}
          >
            <item.icon className="size-4" />
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}
