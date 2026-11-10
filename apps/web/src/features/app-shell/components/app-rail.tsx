"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui"
import { useLogout } from "@/features/auth"
import { ROUTES } from "@/lib/constants/routes"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, PLACEHOLDER_ITEMS } from "../constants"

export function AppRail() {
  const router = useRouter()
  const pathname = usePathname()
  const logout = useLogout()

  const signOut = () => logout.mutateAsync().finally(() => router.replace(ROUTES.login))

  return (
    <aside
      aria-label="Quick navigation"
      className="sticky top-28 my-8 ml-6 hidden w-16 shrink-0 flex-col items-center gap-5 rounded-4xl border border-line bg-panel py-6 lg:flex"
    >
      <nav aria-label="Sections" className="grid gap-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                render={
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "grid size-11 place-items-center rounded-2xl text-muted-foreground outline-none hover:bg-panel-2 hover:text-text focus-visible:ring-3 focus-visible:ring-brand/40",
                      active && "bg-brand-soft text-brand-strong shadow-[0_0_1.25rem_var(--glow)]"
                    )}
                  />
                }
              >
                <item.icon className="size-5" />
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          )
        })}
        {PLACEHOLDER_ITEMS.map((item) => (
          <Tooltip key={item.label}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`${item.label} (coming soon)`}
                  aria-disabled
                  className="grid size-11 cursor-not-allowed place-items-center rounded-2xl text-muted-foreground/60 outline-none"
                />
              }
            >
              <item.icon className="size-5" />
            </TooltipTrigger>
            <TooltipContent side="right">{item.label} · soon</TooltipContent>
          </Tooltip>
        ))}
      </nav>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Sign out"
              onClick={signOut}
              disabled={logout.isPending}
              className="rounded-2xl text-muted-foreground"
            />
          }
        >
          <LogOut className="size-5" />
        </TooltipTrigger>
        <TooltipContent side="right">Sign out</TooltipContent>
      </Tooltip>
    </aside>
  )
}
