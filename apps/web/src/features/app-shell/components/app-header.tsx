"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { Badge, Button, Spinner } from "@/components/ui"
import { Logo, ThemeToggle } from "@/components/shared"
import { MobileNav } from "./mobile-nav"
import { useCurrentWorkspace, useLogout } from "@/features/auth"
import { LiveStatus } from "@/features/integrations"
import { ROUTES } from "@/lib/constants/routes"

export function AppHeader() {
  const router = useRouter()
  const { workspace } = useCurrentWorkspace()
  const logout = useLogout()

  const signOut = () => logout.mutateAsync().finally(() => router.replace(ROUTES.login))

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-panel px-4 sm:px-6">
      <MobileNav />
      <Logo />
      <div className="ml-auto flex items-center gap-4">
        <LiveStatus />
        {workspace && (
          <span className="flex items-center gap-2 text-[0.8125rem]">
            <span className="hidden text-muted-foreground sm:inline">{workspace.name}</span>
            <Badge variant="brand">{workspace.role}</Badge>
          </span>
        )}
        <ThemeToggle />
        <Button variant="outline" size="sm" onClick={signOut} disabled={logout.isPending}>
          {logout.isPending ? <Spinner /> : <LogOut />} Sign out
        </Button>
      </div>
    </header>
  )
}
