'use client';

import type { DrainSetupResult, HerokuApps } from '@ape/api-contracts';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/form';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { startOAuth, useSetupCapabilities } from '../queries';
import { ResultList } from './result-list';
import { HerokuAppPicker } from './setup-callback';

function useRun<T>() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const run = async (fn: () => Promise<T>) => {
    setPending(true);
    setError(null);
    try {
      setResult(await fn());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };
  return { pending, error, result, run, setError };
}

/** Way 5 without copying URLs: we create the drain in Vercel, Heroku or Render. */
export function DrainPanel() {
  const { workspace, can } = useSession();
  const caps = useSetupCapabilities();
  const ws = workspace.id;
  const vercel = useRun<DrainSetupResult>();
  const heroku = useRun<HerokuApps>();
  const render = useRun<DrainSetupResult>();
  const [herokuKey, setHerokuKey] = useState('');

  if (!can('admin'))
    return (
      <p className="m-0 text-[13px] text-ink-muted">
        Ask an admin to connect your hosting platform.
      </p>
    );
  const oauth = caps.data?.oauth;

  return (
    <div className="grid gap-6">
      <section className="grid gap-2" aria-labelledby="vercel-h">
        <h3 id="vercel-h" className="m-0 font-semibold">
          Vercel
        </h3>
        {vercel.result ? (
          <ResultList {...vercel.result} />
        ) : (
          <>
            {oauth?.vercel && (
              <div>
                <Button
                  onClick={() =>
                    void startOAuth(ws, 'vercel').catch((e: unknown) =>
                      vercel.setError(errorMessage(e)),
                    )
                  }
                >
                  Add to Vercel
                </Button>
              </div>
            )}
            <form
              className="grid max-w-[460px] gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void vercel.run(() =>
                  api<DrainSetupResult>(`/workspaces/${ws}/setup/drains/vercel`, {
                    method: 'POST',
                    json: {
                      accessToken: String(f.get('accessToken')),
                      teamId: String(f.get('teamId') || '') || undefined,
                    },
                  }),
                );
              }}
            >
              <Field
                id="vercel-token"
                label={oauth?.vercel ? 'Or paste a Vercel access token' : 'Vercel access token'}
                hint="Account Settings → Tokens. Used once to create the drain, not stored."
              >
                <Input
                  id="vercel-token"
                  name="accessToken"
                  type="password"
                  autoComplete="off"
                  required
                />
              </Field>
              <Field id="vercel-team" label="Team id (for team projects)">
                <Input id="vercel-team" name="teamId" placeholder="team_…" />
              </Field>
              <FormError>{vercel.error}</FormError>
              <div>
                <Button type="submit" variant="secondary" disabled={vercel.pending}>
                  {vercel.pending ? 'Creating drain…' : 'Create the drain'}
                </Button>
              </div>
            </form>
          </>
        )}
      </section>

      <section className="grid gap-2" aria-labelledby="heroku-h">
        <h3 id="heroku-h" className="m-0 font-semibold">
          Heroku
        </h3>
        {heroku.result ? (
          <HerokuAppPicker apps={heroku.result.apps} apiKey={herokuKey || undefined} />
        ) : (
          <>
            {oauth?.heroku && (
              <div>
                <Button
                  onClick={() =>
                    void startOAuth(ws, 'heroku').catch((e: unknown) =>
                      heroku.setError(errorMessage(e)),
                    )
                  }
                >
                  Sign in with Heroku
                </Button>
              </div>
            )}
            <form
              className="grid max-w-[460px] gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void heroku.run(() =>
                  api<HerokuApps>(`/workspaces/${ws}/setup/drains/heroku/apps`, {
                    method: 'POST',
                    json: { apiKey: herokuKey },
                  }),
                );
              }}
            >
              <Field
                id="heroku-key"
                label={oauth?.heroku ? 'Or paste a Heroku API key' : 'Heroku API key'}
                hint="Account settings → API Key, or heroku authorizations:create. Used to add drains, not stored."
              >
                <Input
                  id="heroku-key"
                  type="password"
                  autoComplete="off"
                  required
                  value={herokuKey}
                  onChange={(e) => setHerokuKey(e.target.value)}
                />
              </Field>
              <FormError>{heroku.error}</FormError>
              <div>
                <Button type="submit" variant="secondary" disabled={heroku.pending}>
                  {heroku.pending ? 'Loading apps…' : 'Choose apps'}
                </Button>
              </div>
            </form>
          </>
        )}
      </section>

      {caps.data?.syslog && (
        <section className="grid gap-2" aria-labelledby="render-h">
          <h3 id="render-h" className="m-0 font-semibold">
            Render
          </h3>
          {render.result ? (
            <ResultList {...render.result} />
          ) : (
            <form
              className="grid max-w-[460px] gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void render.run(() =>
                  api<DrainSetupResult>(`/workspaces/${ws}/setup/drains/render`, {
                    method: 'POST',
                    json: { apiKey: String(f.get('apiKey')) },
                  }),
                );
              }}
            >
              <Field
                id="render-key"
                label="Render API key"
                hint="Account Settings → API Keys. Sets the log stream of every workspace the key can see. Not stored."
              >
                <Input id="render-key" name="apiKey" type="password" autoComplete="off" required />
              </Field>
              <FormError>{render.error}</FormError>
              <div>
                <Button type="submit" variant="secondary" disabled={render.pending}>
                  {render.pending ? 'Connecting…' : 'Stream Render logs here'}
                </Button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
