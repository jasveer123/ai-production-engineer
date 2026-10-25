'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROLE_LABEL } from '@/features/auth/roles';
import { useResetSession, useSession } from '@/features/auth/session';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/** Who is signed in, which workspace, and the account actions. */
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
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left hover:bg-surface-hover">
        <span className="grid size-8 flex-none place-items-center rounded-md bg-brand-soft font-display text-[13px] font-bold text-brand-strong">
          {initials(name)}
        </span>
        <span className="min-w-0 text-[13px] leading-5">
          <b className="block truncate">{name}</b>
          <span className="text-ink-muted">{ROLE_LABEL[workspace.role]}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <div className="truncate px-2 py-1 text-[13px] text-ink-muted">{me.user.email}</div>
        {me.workspaces.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {me.workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onSelect={() => {
                  switchWorkspace(w.id);
                  reset();
                }}
                aria-current={w.id === workspace.id || undefined}
                className="aria-[current=true]:font-semibold"
              >
                <span className="truncate">{w.name}</span>
                <span className="text-xs text-ink-muted">{ROLE_LABEL[w.role]}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/">Your account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/onboarding/">New workspace</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void signOut()}
          className="text-danger data-[highlighted]:bg-danger-soft"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WorkspaceName() {
  return <>{useSession().workspace.name}</>;
}
