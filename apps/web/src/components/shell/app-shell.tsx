import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { LiveIndicator } from '@/features/realtime/live-indicator';
import { AccountMenu, WorkspaceName } from './account-menu';
import { DataBadge } from './data-badge';
import { Logo } from './logo';
import { MAIN_NAV, WORKSPACE_NAV, type NavItem } from './nav-config';
import { NavLinks } from './nav-links';
import { ThemeSwitch } from './theme-switch';

function Navigation({ main }: { main: NavItem[] }) {
  return (
    <nav aria-label="Main" className="grid gap-1">
      <NavLinks items={main} />
      <div className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
        Workspace
      </div>
      <NavLinks items={WORKSPACE_NAV} />
    </nav>
  );
}

/** The frame of every screen: sidebar on desktop, a menu on phones, and the top bar. */
export function AppShell({ children }: { children: ReactNode }) {
  // Menu counts will come back once Incidents and Changes read live data.
  const main = MAIN_NAV;
  return (
    <div className="grid min-h-dvh grid-cols-[248px_minmax(0,1fr)] max-[860px]:grid-cols-1">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-raised focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 flex h-dvh flex-col gap-4 overflow-y-auto border-r border-line bg-surface-raised px-3 py-4 max-[860px]:hidden">
        <Link href="/" className="px-1">
          <Logo workspace={<WorkspaceName />} />
        </Link>
        <Navigation main={main} />
        <div className="mt-auto border-t border-line pt-2">
          <AccountMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface/85 px-8 py-3 backdrop-blur max-sm:px-4">
          <details className="relative min-[861px]:hidden">
            <summary
              aria-label="Open menu"
              className="grid size-9 cursor-pointer list-none place-items-center rounded-md text-ink-muted hover:bg-surface-hover [&::-webkit-details-marker]:hidden"
            >
              <Icon name="menu" />
            </summary>
            <div className="absolute left-0 top-11 z-20 w-64 rounded-lg border border-line bg-surface-raised p-3 shadow-overlay">
              <Navigation main={main} />
            </div>
          </details>
          <form action="/logs/" role="search" className="min-w-0 max-w-[460px] flex-1">
            <label htmlFor="global-search" className="sr-only">
              Search logs
            </label>
            <div className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface-raised px-3 text-ink-muted focus-within:border-brand">
              <Icon name="search" size="sm" />
              <input
                id="global-search"
                name="q"
                type="search"
                placeholder="Search logs, e.g. level:error"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              />
            </div>
          </form>
          <div className="ml-auto flex items-center gap-2">
            <LiveIndicator />
            <DataBadge />
            <ThemeSwitch />
          </div>
        </header>
        <main id="content" className="min-w-0 px-8 py-8 max-sm:px-4 max-sm:py-5">
          <div className="mx-auto grid max-w-[1120px] gap-8 max-sm:gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
