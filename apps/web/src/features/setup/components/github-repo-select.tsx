'use client';

import type { Integration } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormError, Input } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { startGitHubInstall, useGitHubSelect } from '../queries';
import { planRepoChanges } from '../repo-changes';

/** After GitHub redirects back: pick which repositories this workspace may use. */
export function GitHubRepoSelect() {
  const { workspace } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const focusId = Number(params.get('installation_id') ?? '') || null;
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Record<number, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const view = useGitHubSelect();

  useEffect(() => {
    if (!view.data) return;
    setPicked((prev) => {
      const next = { ...prev };
      for (const a of view.data.accounts) {
        if (!next[a.installationId]) next[a.installationId] = a.selected;
      }
      return next;
    });
  }, [view.data]);

  const accounts = useMemo(() => view.data?.accounts ?? [], [view.data]);
  // Unticking a saved repo removes it on save; unticking all of an account disconnects it.
  const { toConnect, toDisconnect, added, removed } = planRepoChanges(accounts, picked);
  const anyConnected = accounts.some((a) => a.connected);

  const disconnectAccount = (integrationId: string) =>
    api(`/workspaces/${workspace.id}/integrations/${integrationId}`, { method: 'DELETE' });

  const save = useMutation({
    mutationFn: async () => {
      let last: Integration | undefined;
      for (const c of toConnect) {
        last = await api<Integration>(`/workspaces/${workspace.id}/github/connect`, {
          method: 'POST',
          json: { installationId: c.account.installationId, repositories: c.now },
        });
      }
      for (const c of toDisconnect) {
        if (c.account.integrationId) await disconnectAccount(c.account.integrationId);
      }
      return last;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ws', workspace.id] });
      router.replace('/integrations/code/');
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const disconnect = useMutation({
    mutationFn: disconnectAccount,
    onSuccess: (_, integrationId) => {
      const account = accounts.find((a) => a.integrationId === integrationId);
      if (account) setPicked((p) => ({ ...p, [account.installationId]: [] }));
      void qc.invalidateQueries({ queryKey: ['ws', workspace.id] });
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const focused = useMemo(() => {
    if (!accounts.length) return [];
    if (focusId && accounts.some((a) => a.installationId === focusId)) {
      return [
        ...accounts.filter((a) => a.installationId === focusId),
        ...accounts.filter((a) => a.installationId !== focusId),
      ];
    }
    return accounts;
  }, [accounts, focusId]);

  return (
    <>
      <PageHeader
        eyebrow="Integrations → GitHub → Connect GitHub"
        title="Select GitHub repositories"
      />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-3">
          <h2 className="m-0 font-display text-base font-semibold">Available accounts</h2>
          <p className="m-0 text-[13px] leading-5 text-ink-muted">
            This workspace was granted access to the following GitHub accounts and their
            repositories. Select which repositories should be available to members of{' '}
            <b className="font-semibold text-ink">{workspace.name}</b>.
          </p>
          {view.data?.installUrl && (
            <button
              type="button"
              className="justify-self-start text-[13px] font-semibold text-brand hover:underline"
              onClick={() =>
                void startGitHubInstall(workspace.id, view.data!.installUrl!).catch((e: unknown) =>
                  setError(errorMessage(e)),
                )
              }
            >
              Add GitHub organization or account ↗
            </button>
          )}
        </div>

        <div className="grid gap-4">
          {view.isPending && <p className="m-0 text-ink-muted">Loading GitHub accounts…</p>}
          {view.isError && <FormError>{errorMessage(view.error)}</FormError>}
          {view.data && !view.data.configured && (
            <FormError>The GitHub App is not configured on this server.</FormError>
          )}
          {view.data && view.data.configured && focused.length === 0 && (
            <p className="m-0 rounded-md border border-line bg-surface-raised p-4 text-[13px] leading-5">
              No GitHub account is ready yet. Connect GitHub first, then pick repositories here.
            </p>
          )}
          {focused.map((account) => {
            const q = query.trim().toLowerCase();
            const repos = account.repositories.filter((r) =>
              q ? r.fullName.toLowerCase().includes(q) : true,
            );
            const selected = picked[account.installationId] ?? [];
            const integrationId = account.integrationId;
            const allVisibleChecked =
              repos.length > 0 && repos.every((r) => selected.includes(r.fullName));
            return (
              <section
                key={account.installationId}
                className="overflow-hidden rounded-lg border border-line bg-surface-raised"
              >
                <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={account.avatarUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="size-7 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{account.account}</div>
                    <div className="text-[12px] text-ink-muted">
                      {account.accountType === 'Organization' ? 'Organization' : 'User'}
                      {account.connected
                        ? `, ${account.selected.length} connected to this workspace`
                        : ''}
                    </div>
                  </div>
                  {integrationId && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={disconnect.isPending}
                      onClick={() => {
                        setError(null);
                        if (
                          window.confirm(
                            `Disconnect ${account.account}? Its repositories stop being available to ${workspace.name}. The GitHub App stays installed on GitHub.`,
                          )
                        )
                          disconnect.mutate(integrationId);
                      }}
                    >
                      Disconnect
                    </Button>
                  )}
                </header>
                <div className="grid gap-2 p-3">
                  <div className="relative">
                    <Icon
                      name="search"
                      size="sm"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                    />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search repositories"
                      className="h-9 pl-9"
                      aria-label="Search repositories"
                    />
                  </div>
                  <label className="flex items-center gap-2 px-1 text-[13px] text-ink-muted">
                    <input
                      type="checkbox"
                      checked={allVisibleChecked}
                      onChange={(e) => {
                        const names = repos.map((r) => r.fullName);
                        setPicked((p) => {
                          const current = new Set(p[account.installationId] ?? []);
                          if (e.target.checked) names.forEach((n) => current.add(n));
                          else names.forEach((n) => current.delete(n));
                          return { ...p, [account.installationId]: [...current] };
                        });
                      }}
                    />
                    {repos.length} repositor{repos.length === 1 ? 'y' : 'ies'}
                  </label>
                  <ul className="m-0 grid max-h-[320px] list-none gap-0.5 overflow-auto p-0">
                    {repos.map((repo) => {
                      const checked = selected.includes(repo.fullName);
                      return (
                        <li key={repo.fullName}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-hover">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setPicked((p) => {
                                  const current = new Set(p[account.installationId] ?? []);
                                  if (e.target.checked) current.add(repo.fullName);
                                  else current.delete(repo.fullName);
                                  return { ...p, [account.installationId]: [...current] };
                                })
                              }
                            />
                            <span className="min-w-0 flex-1 truncate">{repo.fullName}</span>
                            {account.connected && account.selected.includes(repo.fullName) && (
                              <Badge tone={checked ? 'ok' : 'warn'}>
                                {checked ? 'Connected' : 'Removing'}
                              </Badge>
                            )}
                            <span className="text-[12px] text-ink-muted">{repo.defaultBranch}</span>
                          </label>
                        </li>
                      );
                    })}
                    {repos.length === 0 && (
                      <li className="px-2 py-3 text-[13px] text-ink-muted">
                        No repositories match that search.
                      </li>
                    )}
                  </ul>
                </div>
              </section>
            );
          })}
          {view.data?.installUrl && (
            <button
              type="button"
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong text-[13px] font-semibold text-ink-muted hover:bg-surface-hover"
              onClick={() =>
                void startGitHubInstall(workspace.id, view.data!.installUrl!).catch((e: unknown) =>
                  setError(errorMessage(e)),
                )
              }
            >
              + Add GitHub organization or account
            </button>
          )}
          <FormError>{error}</FormError>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ButtonLink href="/integrations/code/" variant="ghost">
              Cancel
            </ButtonLink>
            <div className="flex items-center gap-3">
              {(added > 0 || removed > 0) && (
                <span className="text-[13px] text-ink-muted">
                  {[added && `${added} to connect`, removed && `${removed} to remove`]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              )}
              <Button
                onClick={() => {
                  setError(null);
                  const names = toDisconnect.map((c) => c.account.account).join(', ');
                  if (
                    toDisconnect.length &&
                    !window.confirm(
                      `No repositories are selected for ${names}, so ${toDisconnect.length === 1 ? 'it' : 'they'} will be disconnected from ${workspace.name}. Continue?`,
                    )
                  )
                    return;
                  save.mutate();
                }}
                disabled={save.isPending || (added === 0 && removed === 0)}
              >
                {save.isPending ? 'Saving…' : anyConnected ? 'Save changes' : 'Connect selected'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
