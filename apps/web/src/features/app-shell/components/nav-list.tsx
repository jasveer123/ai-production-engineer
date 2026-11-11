"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_GROUPS } from "../constants"

interface NavListProps {
  onNavigate?: () => void
}

export function NavList({ onNavigate }: NavListProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="grid gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="grid gap-1">
          <p className="px-3 font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 border-l-2 border-transparent px-3 py-1.5 text-[0.8125rem] text-muted-foreground outline-none hover:bg-panel-2 hover:text-text focus-visible:ring-3 focus-visible:ring-brand/40",
                  active && "border-brand bg-brand-soft font-medium text-brand-strong"
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
