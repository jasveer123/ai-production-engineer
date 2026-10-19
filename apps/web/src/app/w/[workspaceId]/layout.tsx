'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Badge, Button, ErrorBox, Loading } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useLiveUpdates, type LiveState } from '@/lib/live';
import { NAV } from '@/lib/nav';
import { useMe, useWorkspace } from '@/lib/queries';

const LIVE_LABEL: Record<LiveState, { dot: string; text: string }> = {
  live: { dot: 'bg-ok', text: 'Live' },
  connecting: { dot: 'bg-warn', text: 'Connecting…' },
  offline: { dot: 'bg-subtle', text: 'Offline: refreshing every few seconds' },
};

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const ws = useWorkspace(workspaceId);
  const live = useLiveUpdates(workspaceId);

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace('/login');
  }, [me.error, router]);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    qc.clear();
    router.replace('/login');
  };

  if (me.isPending) return <Loading />;
  if (!me.data)
    return (
      <div className="p-8">
        <ErrorBox error={me.error} />
      </div>
    );

  const base = `/w/${workspaceId}`;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-line bg-surface md:w-60 md:border-r md:border-b-0">
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">AI Production Engineer</p>
            <span
              className="flex items-center gap-1.5 text-xs text-subtle"
              title={LIVE_LABEL[live].text}
              role="status"
            >
              <span className={`h-2 w-2 rounded-full ${LIVE_LABEL[live].dot}`} aria-hidden />
              <span className="sr-only md:not-sr-only">
                {live === 'live' ? 'Live' : live === 'connecting' ? '…' : 'Offline'}
              </span>
            </span>
          </div>
          <label className="mt-3 block text-xs text-subtle" htmlFor="ws-switch">
            Workspace
          </label>
          <select
            id="ws-switch"
            className="mt-1 h-8 w-full rounded-md border border-line bg-surface px-2 text-sm"
            value={workspaceId}
            onChange={(e) =>
              e.target.value === '__new'
                ? router.push('/workspaces/new')
                : router.push(`/w/${e.target.value}`)
            }
          >
            {me.data.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
            <option value="__new">+ New workspace</option>
          </select>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible"
          aria-label="Workspace"
        >
          {NAV.map((item) => {
            const href = item.slug ? `${base}/${item.slug}` : base;
            const active = item.slug ? pathname.startsWith(href) : pathname === base;
            return (
              <Link
                key={item.label}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center justify-between whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                  active ? 'bg-muted font-medium' : 'text-subtle hover:bg-muted hover:text-fg'
                }`}
              >
                {item.label}
                {item.phase && (
                  <span className="ml-2 hidden text-[10px] uppercase md:inline">soon</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden border-t border-line p-4 md:block">
          <p className="truncate text-sm font-medium">{me.data.user.name ?? me.data.user.email}</p>
          <p className="truncate text-xs text-subtle">{me.data.user.email}</p>
          <div className="mt-2 flex items-center justify-between">
            {ws.data && <Badge tone={ws.data.role}>{ws.data.role}</Badge>}
            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        {ws.error instanceof ApiError && ws.error.status === 404 ? (
          <div className="max-w-md">
            <h1 className="text-lg font-semibold">Workspace not found</h1>
            <p className="mt-1 text-sm text-subtle">
              It doesn&apos;t exist or you are no longer a member.
            </p>
            <Link href="/" className="mt-4 inline-block text-sm text-accent hover:underline">
              Go to my workspaces
            </Link>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
