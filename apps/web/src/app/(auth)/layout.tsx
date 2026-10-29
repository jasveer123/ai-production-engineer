import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/shell/logo';
import { ThemeSwitch } from '@/components/shell/theme-switch';
import { AuthShowcase } from '@/features/auth/components/auth-showcase';

const AUTH_CONTROLS = [
  '[&_input]:h-11 [&_input]:rounded-[10px] [&_input]:border-transparent [&_input]:bg-surface-hover',
  '[&_input:focus]:border-brand [&_input:focus]:bg-surface-raised',
  '[&_input[aria-invalid=true]]:border-danger',
  '[&_button[type=submit]]:h-11 [&_button[type=submit]]:rounded-[10px]',
].join(' ');

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:p-3">
      <AuthShowcase />
      <div className="grid min-h-dvh grid-rows-[auto_1fr_auto] lg:min-h-[calc(100dvh-24px)]">
        {}
        <header className="px-8 py-4 max-sm:px-4 lg:invisible">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
        </header>
        <main id="content" className="grid place-items-center px-4 pb-10 pt-6">
          <div className={`w-full max-w-[400px] ${AUTH_CONTROLS}`}>{children}</div>
        </main>
        <footer className="flex items-center justify-between gap-3 px-8 pb-4 text-[13px] text-ink-muted max-sm:px-4">
          <span>© {new Date().getFullYear()} AI Production Engineer</span>
          <ThemeSwitch />
        </footer>
      </div>
    </div>
  );
}
