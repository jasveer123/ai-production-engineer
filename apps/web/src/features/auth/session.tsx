'use client';

import type { Me, Role } from '@ape/api-contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/api';
import { hasRole } from './roles';

const STORAGE_KEY = 'ape.workspace';

export const ME_KEY = ['auth', 'me'] as const;

export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: () => api<Me>('/auth/me'), staleTime: 60_000 });
}

type Workspace = Me['workspaces'][number];

interface Session {
  me: Me;
  workspace: Workspace;
  role: Role;
  can: (role: Role) => boolean;
  switchWorkspace: (id: string) => void;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession must be used inside <AuthGate>');
  return s;
}

export const useWorkspaceId = () => useSession().workspace.id;

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AuthGate({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => setSelected(readStored()), []);

  const unauthenticated = me.error instanceof ApiError && me.error.status === 401;
  const noWorkspace = me.data && me.data.workspaces.length === 0;

  useEffect(() => {
    if (unauthenticated) router.replace(`/login/?next=${encodeURIComponent(pathname)}`);
    else if (noWorkspace) router.replace('/onboarding/');
  }, [unauthenticated, noWorkspace, pathname, router]);

  const session = useMemo<Session | null>(() => {
    if (!me.data || me.data.workspaces.length === 0) return null;
    const workspace = me.data.workspaces.find((w) => w.id === selected) ?? me.data.workspaces[0]!;
    return {
      me: me.data,
      workspace,
      role: workspace.role,
      can: (role: Role) => hasRole(workspace.role, role),
      switchWorkspace: (id: string) => {
        try {
          localStorage.setItem(STORAGE_KEY, id);
        } catch {}
        setSelected(id);
      },
    };
  }, [me.data, selected]);

  if (me.isPending || unauthenticated || noWorkspace)
    return <FullPageMessage>Loading your workspace…</FullPageMessage>;
  if (me.error || !session)
    return (
      <FullPageMessage>
        We could not load your account.{' '}
        <button className="text-brand underline" onClick={() => void me.refetch()}>
          Try again
        </button>
      </FullPageMessage>
    );
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function FullPageMessage({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="grid min-h-dvh place-items-center p-6 text-ink-muted">
      <p>{children}</p>
    </div>
  );
}

export function useResetSession() {
  const qc = useQueryClient();
  return () => qc.clear();
}
