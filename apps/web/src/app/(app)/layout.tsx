import { AppHeader, AppRail } from "@/features/app-shell"
import { RequireSession } from "@/features/auth"
import { TokenSecretProvider } from "@/features/integrations"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession>
      <TokenSecretProvider>
        <div className="stage flex min-h-screen flex-col">
          <AppHeader />
          <div className="flex flex-1 items-start">
            <AppRail />
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
              <div className="mx-auto max-w-[72rem]">
                <div id="composer-slot" />
                {children}
              </div>
            </main>
          </div>
        </div>
      </TokenSecretProvider>
    </RequireSession>
  )
}
