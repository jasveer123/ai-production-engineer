'use client';

import type { Integration, IntegrationWithSecret } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { CodeSnippet } from '@/components/ui/code-snippet';
import { Dialog } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { SetupPrPanel } from '@/features/setup/components/setup-pr-panel';
import { GitHubConnectFlow } from '@/features/setup/components/github-connect-flow';
import { useGitHubOverview } from '@/features/setup/queries';
import { useIntegrations } from '../queries';

const CARD =
  'flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-6 shadow-raised max-sm:p-4';
/** Pinned to the bottom so the three cards' footers line up. */
const FOOTER =
  'mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3';
const ICON_BUTTON =
  'inline-grid size-8 place-items-center rounded-sm text-ink-muted hover:bg-surface-hover hover:text-ink';
const ext = 'inline-flex items-center gap-1 font-semibold text-brand hover:underline';
const STATUS_BADGE: Record<
  Integration['status'],
  { tone: 'ok' | 'danger' | 'warn' | 'neutral'; text: string }
> = {
  connected: { tone: 'ok', text: 'Connected' },
  error: { tone: 'danger', text: 'Needs attention' },
  pending: { tone: 'warn', text: 'Waiting' },
  disconnected: { tone: 'neutral', text: 'Disconnected' },
};

/** The deploy step for GitHub Actions: an HMAC-signed JSON body, like the server verifies. */
export function deployActionStep(service = 'checkout-api'): string {
  return `- name: Tell AI Production Engineer about this deploy
  env:
    APE_DEPLOY_URL: \${{ secrets.APE_DEPLOY_URL }}
    APE_DEPLOY_SECRET: \${{ secrets.APE_DEPLOY_SECRET }}
  run: |
    body=$(printf '{"service":"${service}","env":"production","commit_sha":"%s","version":"%s"}' "$GITHUB_SHA" "$GITHUB_REF_NAME")
    ts=$(date +%s)
    sig="sha256=$(printf '%s.%s' "$ts" "$body" | openssl dgst -sha256 -hmac "$APE_DEPLOY_SECRET" | sed 's/^.* //')"
    curl -fsS -X POST "$APE_DEPLOY_URL" -H "Content-Type: application/json" \\
      -H "x-ape-timestamp: $ts" -H "x-ape-signature: $sig" -d "$body"`;
}

export function CodeCards() {
  const integrations = useIntegrations();
  if (integrations.isPending) return <ListSkeleton label="Loading" />;
  if (integrations.isError)
    return <FormError>Could not load integrations: {errorMessage(integrations.error)}</FormError>;
  const live = integrations.data.filter((i) => i.status !== 'disconnected');
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      <GitHubCard row={live.find((i) => i.provider === 'github')} />
      <article className={CARD}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-surface-sunken font-display font-bold text-ink">
            GL
          </span>
          <div className="flex-1">
            <h3 className="font-display text-base font-semibold">GitLab</h3>
            <p className="m-0 text-[13px] text-ink-muted">Merge requests</p>
          </div>
          <Badge>Coming soon</Badge>
        </div>
        <p className="m-0 text-[13px] leading-5 text-ink-muted">
          GitLab support is planned. GitHub is the only code host today.
        </p>
      </article>
      <DeployCard row={live.find((i) => i.provider === 'deploy_webhook')} />
    </div>
  );
}

function GitHubCard({ row }: { row: Integration | undefined }) {
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

function DeployCard({ row }: { row: Integration | undefined }) {
  const { workspace, can } = useSession();
  const admin = can('admin');
  const qc = useQueryClient();
  const [secret, setSecret] = useState<IntegrationWithSecret | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['ws', workspace.id, 'integrations'] });
  const create = useMutation({
    mutationFn: () =>
      row
        ? api<IntegrationWithSecret>(
            `/workspaces/${workspace.id}/integrations/${row.id}/rotate-secret`,
            { method: 'POST' },
          )
        : api<IntegrationWithSecret>(`/workspaces/${workspace.id}/integrations`, {
            method: 'POST',
            json: { provider: 'deploy_webhook', name: 'Deploy pipeline' },
          }),
    onSuccess: (r) => (setSecret(r), setError(null), void refresh()),
    onError: (e) => setError(errorMessage(e)),
  });
  const badge = row ? STATUS_BADGE[row.status] : null;

  return (
    <article className={CARD}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-surface-sunken text-ink">
          <Icon name="send" size="lg" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-base font-semibold">Deploy pipeline</h3>
          <p className="m-0 text-[13px] text-ink-muted">GitHub Actions or any CI</p>
        </div>
        {badge ? (
          <Badge tone={badge.tone}>
            {row!.status === 'pending' ? 'No deploy yet' : badge.text}
          </Badge>
        ) : (
          <Badge>Not connected</Badge>
        )}
      </div>
      <p className="m-0 text-[13px] leading-5 text-ink-muted">
        A signed event for every deploy, so the AI knows which version is live and can check that a
        fix worked.
      </p>
      {admin && (
        <details className="rounded-md border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Set up with a pull request (no secrets)
          </summary>
          <div className="mt-3">
            <SetupPrPanel kind="deploy" />
          </div>
        </details>
      )}
      <FormError>{error}</FormError>
      <div className={FOOTER}>
        <span className="text-[13px] text-ink-muted">
          {row ? `Last deploy ${formatAgo(row.lastSyncAt)}` : 'No deploys yet'}
        </span>
        <div className="flex gap-2">
          <ButtonLink href="/deploys/" size="sm" variant="ghost">
            See deploys
          </ButtonLink>
          {admin && (
            <Button
              size="sm"
              variant={row ? 'secondary' : 'primary'}
              onClick={() =>
                (!row ||
                  window.confirm(
                    'Rotate the signing secret? The old one stops working at once.',
                  )) &&
                create.mutate()
              }
              disabled={create.isPending}
            >
              {row ? 'Rotate secret' : 'Use a signing secret'}
            </Button>
          )}
        </div>
      </div>
      <Dialog
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title="Add these to your CI secrets"
        description="The secret is shown once."
        wide
      >
        {secret && (
          <div className="grid gap-3">
            <CodeSnippet label="APE_DEPLOY_URL" code={secret.webhookUrl ?? ''} />
            <CodeSnippet label="APE_DEPLOY_SECRET" code={secret.signingSecret ?? ''} />
            <CodeSnippet
              label=".github/workflows/deploy.yml (after your deploy step)"
              code={deployActionStep()}
            />
            <div className="flex justify-end">
              <Button onClick={() => setSecret(null)}>Done</Button>
            </div>
          </div>
        )}
      </Dialog>
    </article>
  );
}

/** The repositories the AI can read, plus one short notice per thing GitHub is not allowing. */
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
