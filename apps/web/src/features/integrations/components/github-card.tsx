'use client';

import type { Integration } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { FormError } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { useSession } from '@/features/auth';
import { api, errorMessage } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { GitHubConnectFlow } from '@/features/setup';
import { useGitHubOverview } from '@/features/setup';
import { CARD, FOOTER, ICON_BUTTON, STATUS_BADGE, ext } from './card-styles';

export function GitHubCard({ row }: { row: Integration | undefined }) {
  const { workspace, can } = useSession();
  const qc = useQueryClient();
  const admin = can('admin');
  const [error, setError] = useState<string | null>(null);
  const test = useMutation({
    mutationFn: (id: string) =>
      api(`/workspaces/${workspace.id}/integrations/${id}/test`, { method: 'POST' }),
    // Also refreshes the repository list and permission check shown on the card.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws', workspace.id] }),
    onError: (e) => setError(errorMessage(e)),
  });
  const badge = row ? STATUS_BADGE[row.status] : null;

  return (
    <article className={CARD}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-surface-sunken text-ink">
          <Icon name="git" size="lg" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-base font-semibold">GitHub</h3>
          <p className="m-0 text-[13px] text-ink-muted">Read code, open pull requests</p>
        </div>
        {badge ? <Badge tone={badge.tone}>{badge.text}</Badge> : <Badge>Not connected</Badge>}
      </div>
      {row ? (
        <>
          <GitHubConnectedDetails />
          {row.lastError && <FormError>{row.lastError}</FormError>}
          <FormError>{error}</FormError>
          <div className={FOOTER}>
            <span className="text-[13px] text-ink-muted">
              {test.isPending ? 'Checking…' : `Checked ${formatAgo(row.lastSyncAt)}`}
            </span>
            <div className="flex items-center gap-1">
              {admin && (
                <button
                  type="button"
                  className={ICON_BUTTON}
                  onClick={() => test.mutate(row.id)}
                  disabled={test.isPending}
                  aria-label="Check the GitHub connection again"
                  title="Check again"
                >
                  <Icon name="refresh" size="sm" />
                </button>
              )}
              <a
                href="https://github.com/settings/installations"
                target="_blank"
                rel="noreferrer"
                className={ICON_BUTTON}
                aria-label="Open the GitHub App installation on GitHub"
                title="Open on GitHub"
              >
                <Icon name="external" size="sm" />
              </a>
              {admin && (
                <ButtonLink href="/integrations/github/select/" size="sm" variant="secondary">
                  Manage repositories
                </ButtonLink>
              )}
            </div>
          </div>
        </>
      ) : !admin ? (
        <p className="m-0 text-[13px] text-ink-muted">Ask an admin to connect GitHub.</p>
      ) : (
        <GitHubConnectFlow />
      )}
    </article>
  );
}

function GitHubConnectedDetails() {
  const overview = useGitHubOverview();
  if (overview.isPending) return <p className="m-0 text-[13px] text-ink-muted">Checking GitHub…</p>;
  if (overview.isError)
    return <FormError>Could not check GitHub: {errorMessage(overview.error)}</FormError>;
  const o = overview.data;
  const inst = o.installations[0];
  const repos = o.installations.flatMap((i) => i.repositories);
  const missing = o.missing.deployWorkflow;
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <span className="text-[13px] text-ink-muted">
          {repos.length
            ? `The AI can read ${repos.length} ${repos.length === 1 ? 'repository' : 'repositories'}`
            : 'No repositories shared yet'}
        </span>
        <ul className="m-0 grid list-none gap-1 p-0">
          {repos.slice(0, 3).map((r) => (
            <li key={r} className="flex min-w-0 items-center gap-2 text-sm">
              <Icon name="git" size="sm" className="shrink-0 text-ink-muted" />
              <span className="truncate">{r}</span>
            </li>
          ))}
          {repos.length > 3 && (
            <li className="text-[13px] text-ink-muted">and {repos.length - 3} more</li>
          )}
        </ul>
      </div>
      {inst && missing.length > 0 && (
        <p className="m-0 flex gap-2 rounded-md bg-warn-soft px-3 py-2 text-[13px] leading-5">
          <Icon name="alert" size="sm" className="mt-0.5 shrink-0" />
          <span>
            Needs <b className="font-semibold">{missing.join(', ')}</b> for deploy setup.{' '}
            <a
              href={o.appPermissionsUrl ?? inst.manageUrl}
              target="_blank"
              rel="noreferrer"
              className={ext}
            >
              Add it
            </a>
            , then{' '}
            <a href={inst.manageUrl} target="_blank" rel="noreferrer" className={ext}>
              accept it
            </a>
            .
          </span>
        </p>
      )}
      {inst && o.unreachableServiceRepos.length > 0 && (
        <p className="m-0 flex gap-2 rounded-md bg-info-soft px-3 py-2 text-[13px] leading-5">
          <Icon name="info" size="sm" className="mt-0.5 shrink-0" />
          <span>
            Not shared yet: {o.unreachableServiceRepos.join(', ')}.{' '}
            <a href={inst.manageUrl} target="_blank" rel="noreferrer" className={ext}>
              Add on GitHub
            </a>
          </span>
        </p>
      )}
    </div>
  );
}
