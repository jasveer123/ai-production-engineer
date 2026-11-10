import { Logo, ThemeToggle } from "@/components/shared"
import { AuthShowcase } from "@/features/auth/components"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="stage grid min-h-screen gap-3 p-3 lg:grid-cols-[1.05fr_1fr]">
      <AuthShowcase />
      <div className="grid grid-rows-[auto_1fr_auto]">
        <div className="flex items-center justify-between px-4 py-2 lg:justify-end">
          <Logo className="lg:hidden" />
          <ThemeToggle />
        </div>
        <main className="flex justify-center px-4 pt-1 pb-6">{children}</main>
        <footer className="flex items-center justify-between px-4 pb-3 text-[0.8125rem] text-muted-foreground">
          <span>© 2026 Pramaan</span>
          <span className="font-mono">Night · Day</span>
        </footer>
      </div>
    </div>
  )
}
