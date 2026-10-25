'use client';

import type { DrainSetupResult, OAuthCallbackResult } from '@ape/api-contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormError } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { takeStoredState } from '../queries';
import { ResultList } from './result-list';

const NAMES: Record<string, string> = {
  github: 'GitHub',
  sentry: 'Sentry',
  vercel: 'Vercel',
  heroku: 'Heroku',
};
const BACK: Record<string, string> = {
  github: '/integrations/code/',
  sentry: '/integrations/tools/',
  vercel: '/integrations/log-drain/',
  heroku: '/integrations/log-drain/',
};

/** Where providers send people back after they approve. Finishes the setup, then shows the result. */
export function SetupCallback({ provider }: { provider: string }) {
  const { workspace } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [result, setResult] = useState<OAuthCallbackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const name = NAMES[provider] ?? provider;

  useEffect(() => {
    // The code is single-use: run once, also under React strict mode.
    if (started.current) return;
    started.current = true;
    const state = params.get('state') ?? takeStoredState(provider);
    const ws = workspace.id;
    const run = async () => {
      if (provider === 'github') {
        const installationId = params.get('installation_id');
        if (!installationId) throw new Error('GitHub did not say which installation was made.');
        return api<OAuthCallbackResult>(`/workspaces/${ws}/setup/github/callback`, {
          method: 'POST',
          json: { installationId, state },
        });
      }
      if (!NAMES[provider]) throw new Error('Unknown provider.');
      const error = params.get('error_description') ?? params.get('error');
      if (error) throw new Error(`${name} said: ${error}`);
      return api<OAuthCallbackResult>(`/workspaces/${ws}/setup/oauth/${provider}/callback`, {
        method: 'POST',
        json: {
          state,
          code: params.get('code') ?? undefined,
          installationId: params.get('installationId') ?? undefined,
          configurationId: params.get('configurationId') ?? undefined,
          teamId: params.get('teamId') ?? undefined,
        },
      });
    };
    run()
      .then((r) => {
        void qc.invalidateQueries({ queryKey: ['ws', ws] });
        if (provider === 'github' && r.githubInstallationId) {
          router.replace(`/integrations/github/select/?installation_id=${r.githubInstallationId}`);
          return;
        }
        setResult(r);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [params, provider, workspace.id, qc, name, router]);

  return (
    <>
      <PageHeader eyebrow="Integrations" title={`Connecting ${name}`} />
      <Card className="grid gap-4">
        {error ? (
          <>
            <FormError>{error}</FormError>
            <ButtonLink href={BACK[provider] ?? '/integrations/'} variant="secondary">
              Back to integrations
            </ButtonLink>
          </>
        ) : !result ? (
          <p role="status" className="m-0 text-ink-muted">
            Finishing the connection with {name}…
          </p>
        ) : (
          <>
            <ResultList done={result.done} todo={result.todo} />
            {result.herokuApps ? (
              <HerokuAppPicker apps={result.herokuApps} />
            ) : (
              <div>
                <ButtonLink href={BACK[provider] ?? '/integrations/'}>Continue</ButtonLink>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}

/** After "Sign in with Heroku": choose which apps send logs. */
export function HerokuAppPicker({ apps, apiKey }: { apps: string[]; apiKey?: string }) {
  const { workspace } = useSession();
  const [picked, setPicked] = useState<string[]>(apps.slice(0, 1));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DrainSetupResult | null>(null);

  if (result) return <ResultList done={result.done} todo={result.todo} failed={result.failed} />;
  if (apps.length === 0) return <FormError>This Heroku account has no apps.</FormError>;
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
          setResult(
            await api<DrainSetupResult>(`/workspaces/${workspace.id}/setup/drains/heroku`, {
              method: 'POST',
              json: { apps: picked, apiKey },
            }),
          );
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset className="grid gap-2 border-0 p-0">
        <legend className="mb-1 text-[13px] font-semibold">Apps that should send logs</legend>
        {apps.map((a) => (
          <label key={a} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={picked.includes(a)}
              onChange={(e) =>
                setPicked((p) => (e.target.checked ? [...p, a] : p.filter((x) => x !== a)))
              }
            />
            {a}
          </label>
        ))}
      </fieldset>
      <FormError>{error}</FormError>
      <div>
        <Button type="submit" disabled={pending || picked.length === 0}>
          {pending
            ? 'Adding drains…'
            : `Add drains to ${picked.length} app${picked.length === 1 ? '' : 's'}`}
        </Button>
      </div>
    </form>
  );
}
