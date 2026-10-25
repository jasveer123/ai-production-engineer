'use client';

import type { SetupPrResult } from '@ape/api-contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { useSession } from '@/features/auth/session';
import { useDiscoveredServices, useServices } from '@/features/services/queries';
import { serviceNamesFor } from '@/features/services/repo-options';
import { api, errorMessage } from '@/lib/api';
import { useGitHubOverview } from '../queries';
import { GitHubAccessNotes } from './github-access-notes';
import { ResultList } from './result-list';

const COPY = {
  agent: {
    action: 'Open the pull request',
    explain:
      'We add the package to your app and load it before anything else. You review and merge it.',
  },
  deploy: {
    action: 'Open the pull request',
    explain:
      'We add a small GitHub Actions workflow that tells us which commit is live after each deploy. It needs no secrets.',
  },
};

/** Opens a pull request in the customer's repo that does the setup for them. */
export function SetupPrPanel({ kind }: { kind: 'agent' | 'deploy' }) {
  const { workspace, can } = useSession();
  const overview = useGitHubOverview();
  const [result, setResult] = useState<SetupPrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const services = useServices();
  const discovered = useDiscoveredServices();
  const [repo, setRepo] = useState<string | null>(null);
  // null until the person types, so the name keeps following the selected repository.
  const [service, setService] = useState<string | null>(null);
  const open = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api<SetupPrResult>(`/workspaces/${workspace.id}/setup/pull-requests`, {
        method: 'POST',
        json: { ...body, kind },
      }),
    onSuccess: (r) => (setResult(r), setError(null)),
    onError: (e) => setError(errorMessage(e)),
  });

  if (!can('admin'))
    return (
      <p className="m-0 text-[13px] text-ink-muted">Ask an admin to open the setup pull request.</p>
    );
  if (overview.isPending) return <p className="m-0 text-[13px] text-ink-muted">Checking GitHub…</p>;
  if (overview.isError)
    return <FormError>Could not check GitHub: {errorMessage(overview.error)}</FormError>;
  const o = overview.data;
  if (!o.configured)
    return (
      <p className="m-0 text-[13px] text-ink-muted">
        The GitHub App is not configured on this server (GITHUB_APP_ID).
      </p>
    );
  if (o.installations.length === 0)
    return (
      <div className="grid gap-2">
        <p className="m-0 text-[13px] text-ink-muted">
          Connect GitHub first. Then we can open the pull request for you.
        </p>
        <div>
          <ButtonLink href="/integrations/code/" size="sm" variant="secondary">
            Connect GitHub
          </ButtonLink>
        </div>
      </div>
    );
  const list = o.installations.flatMap((i) => i.repositories);
  const notes = (
    <GitHubAccessNotes
      overview={o}
      need={kind === 'deploy' ? 'deployWorkflow' : 'setupPullRequest'}
      onRefresh={() => void overview.refetch()}
      refreshing={overview.isFetching}
    />
  );
  if (list.length === 0)
    return (
      <div className="grid gap-2">
        <p className="m-0 text-[13px] text-ink-muted">
          GitHub is connected, but the App has no repositories yet.
        </p>
        {notes}
      </div>
    );
  const selectedRepo = repo ?? list[0]!;
  const names = serviceNamesFor(
    selectedRepo,
    services.data ?? [],
    (discovered.data ?? []).map((d) => d.name),
    list,
  );
  const blocked = o.missing[kind === 'deploy' ? 'deployWorkflow' : 'setupPullRequest'].length > 0;

  if (result)
    return (
      <div className="grid gap-3">
        <a
          href={result.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 font-semibold text-brand hover:underline"
        >
          Pull request #{result.number}
          {result.draft ? ' (draft)' : ''} {result.existing ? 'is already open' : 'opened'}{' '}
          <Icon name="external" size="sm" />
        </a>
        <ResultList done={result.done} todo={result.todo} />
        <div>
          <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
            Open another
          </Button>
        </div>
      </div>
    );

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const body: Record<string, string> = {
          repository: String(f.get('repository')),
          service: String(f.get('service')).trim(),
          environment: String(f.get('environment')).trim() || 'production',
        };
        const dir = String(f.get('directory') ?? '').trim();
        if (dir) body.directory = dir;
        open.mutate(body);
      }}
    >
      <p className="m-0 text-[13px] text-ink-muted">{COPY[kind].explain}</p>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Field id={`${kind}-repo`} label="Repository">
          <Select
            id={`${kind}-repo`}
            name="repository"
            required
            value={selectedRepo}
            onChange={(e) => setRepo(e.target.value)}
          >
            {list.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id={`${kind}-service`}
          label="Service name"
          hint="Suggested from your repository and services. Letters, numbers, dots, dashes and underscores."
        >
          <Input
            id={`${kind}-service`}
            name="service"
            required
            pattern="[A-Za-z0-9._\-]+"
            maxLength={100}
            list={`${kind}-service-options`}
            value={service ?? names[0] ?? ''}
            // Spaces are not allowed in service names; turn them into dashes as the person types.
            onChange={(e) => setService(e.target.value.replace(/\s+/g, '-'))}
            title="Letters, numbers, dots, dashes and underscores only, e.g. checkout-api"
          />
          <datalist id={`${kind}-service-options`}>
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>
        <Field id={`${kind}-env`} label="Environment">
          <Input id={`${kind}-env`} name="environment" defaultValue="production" maxLength={40} />
        </Field>
        {kind === 'agent' && (
          <Field id={`${kind}-dir`} label="App folder (monorepos)" hint="Leave empty to detect it.">
            <Input id={`${kind}-dir`} name="directory" placeholder="services/api" maxLength={200} />
          </Field>
        )}
      </div>
      {notes}
      <FormError>{error}</FormError>
      <div>
        <Button type="submit" disabled={open.isPending || blocked}>
          {open.isPending ? 'Opening…' : COPY[kind].action}
        </Button>
      </div>
    </form>
  );
}
