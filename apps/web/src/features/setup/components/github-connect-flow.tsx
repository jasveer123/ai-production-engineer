'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { useResetSession, useSession } from '@/features/auth/session';
import { errorMessage } from '@/lib/api';
import { startGitHubInstall, useGitHubApp } from '../queries';

const STEPS = [
  'Click "Connect GitHub". GitHub opens in this tab.',
  'Choose the account and repositories this workspace may use, then install.',
  'You come back here to confirm the repositories and connect them.',
];

/** Not connected yet: send the admin to GitHub, then to the repository picker. */
export function GitHubConnectFlow() {
  const { workspace, me, switchWorkspace } = useSession();
  const reset = useResetSession();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const app = useGitHubApp();

  if (app.isPending)
    return <p className="m-0 text-[13px] text-ink-muted">Checking the GitHub App…</p>;
  if (app.isError) return <FormError>{errorMessage(app.error)}</FormError>;
  const data = app.data;
  if (!data.configured)
    return (
      <p className="m-0 rounded-sm bg-surface-sunken px-2 py-1.5 text-[13px] leading-5">
        The GitHub App is not configured on this server. Set GITHUB_APP_ID and
        GITHUB_APP_PRIVATE_KEY_PATH in services/api/.env, then restart the API.
      </p>
    );

  const elsewhere = data.connectedElsewhere;
  return (
    <div className="grid gap-3">
      {elsewhere.map((e) =>
        e.workspaceId ? (
          <Banner
            key={e.id}
            tone="info"
            title={`Your GitHub (${e.account}) is also connected to "${e.workspaceName}".`}
          >
            Each workspace has its own repository list.{' '}
            <button
              type="button"
              className="text-brand underline underline-offset-[3px]"
              onClick={() => {
                switchWorkspace(e.workspaceId!);
                reset();
              }}
            >
              Switch to {e.workspaceName}
            </button>
            , or pick repositories for &quot;{workspace.name}&quot; below.
          </Banner>
        ) : (
          <Banner
            key={e.id}
            tone="info"
            title={`The GitHub account ${e.account} is connected to another workspace.`}
          >
            Ask its owner to invite you ({me.user.email}), or install the app on a different GitHub
            account or organization.
          </Banner>
        ),
      )}

      {data.installations.length > 0 && (
        <div className="grid gap-2 rounded-md border border-line p-3">
          <span className="text-[13px] font-semibold">GitHub accounts ready to connect</span>
          {data.installations.map((inst) => (
            <div key={inst.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span>
                {inst.account} ·{' '}
                {inst.repositorySelection === 'all' ? 'all repositories' : 'selected repositories'}
              </span>
              <Button
                size="sm"
                onClick={() =>
                  router.push(`/integrations/github/select/?installation_id=${inst.id}`)
                }
              >
                Select repositories
              </Button>
            </div>
          ))}
        </div>
      )}

      <ol className="m-0 grid gap-1.5 pl-5 text-[13px] leading-5">
        {STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <FormError>{error}</FormError>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
        {data.installUrl && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              setError(null);
              setPending(true);
              void startGitHubInstall(workspace.id, data.installUrl!).catch((e: unknown) => {
                setPending(false);
                setError(errorMessage(e));
              });
            }}
          >
            {pending ? 'Opening GitHub…' : 'Connect GitHub'} <Icon name="external" size="sm" />
          </Button>
        )}
      </div>
    </div>
  );
}
