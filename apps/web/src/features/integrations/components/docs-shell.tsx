import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Logo, ThemeToggle } from "@/components/shared"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { DocsSidebar } from "./docs-sidebar"

interface DocsShellProps {
  children: React.ReactNode
}

export function DocsShell({ children }: DocsShellProps) {
  return (
    <div className="stage min-h-screen">
      <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-line bg-panel px-6 py-3">
        <Logo />
        <span className="border-l border-line pl-4 font-mono text-[0.6875rem] tracking-[0.12em] text-muted-foreground uppercase">
          Docs
        </span>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={ROUTES.integrations} />}
          >
            <ArrowLeft /> Back to app
          </Button>
        </div>
      </header>
      <div className="mx-auto flex max-w-[78rem] gap-10 px-6 py-10">
        <DocsSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
