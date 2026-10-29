'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROLE_LABEL } from '@/features/auth/roles';
import { useResetSession, useSession } from '@/features/auth/session';
import { api } from '@/lib/api';

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export function AccountMenu() {
  const { me, workspace, switchWorkspace } = useSession();
  const reset = useResetSession();
  const router = useRouter();
  const name = me.user.name ?? me.user.email;

  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    reset();
    router.replace('/login/');
  }

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-md px-3 py-2 hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
        <span className="grid size-8 flex-none place-items-center rounded-md bg-brand-soft font-display text-[13px] font-bold text-brand-strong">
          {initials(name)}
        </span>
        <span className="min-w-0 text-[13px] leading-5">
          <b className="block truncate">{name}</b>
          <span className="text-ink-muted">{ROLE_LABEL[workspace.role]}</span>
        </span>
      </summary>
      <div className="absolute bottom-14 left-0 z-20 grid w-60 gap-1 rounded-lg border border-line bg-surface-raised p-2 text-sm shadow-overlay">
        <div className="truncate px-2 py-1 text-[13px] text-ink-muted">{me.user.email}</div>
        {me.workspaces.length > 1 && (
          <div className="grid gap-0.5 border-t border-line pt-1">
            <span className="px-2 pt-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
              Workspaces
            </span>
            {me.workspaces.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  switchWorkspace(w.id);
                  reset();
                }}
                aria-current={w.id === workspace.id || undefined}
                className="flex items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-surface-hover aria-[current=true]:font-semibold"
              >
                <span className="truncate">{w.name}</span>
                <span className="text-xs text-ink-muted">{ROLE_LABEL[w.role]}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-0.5 border-t border-line pt-1">
          <Link href="/account/" className="rounded-sm px-2 py-1.5 hover:bg-surface-hover">
            Your account
          </Link>
          <Link href="/onboarding/" className="rounded-sm px-2 py-1.5 hover:bg-surface-hover">
            New workspace
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-sm px-2 py-1.5 text-left text-danger hover:bg-danger-soft"
          >
            Sign out
          </button>
        </div>
      </div>
    </details>
  );
}

export function WorkspaceName() {
  return <>{useSession().workspace.name}</>;
}
