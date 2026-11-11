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
    <nav aria-label="Main" className="grid gap-4 px-2">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="grid gap-0.5">
          <p className="px-2 pb-1 text-[0.6875rem] font-medium text-muted-foreground">
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
                  "flex h-8 items-center gap-2.5 rounded-md px-2 text-[0.8125rem] text-muted-foreground outline-none hover:bg-panel-2 hover:text-text focus-visible:ring-2 focus-visible:ring-brand/50",
                  active && "bg-panel-2 font-medium text-text"
                )}
              >
                <item.icon className={cn("size-4 shrink-0", active && "text-brand")} />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
