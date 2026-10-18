'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { IntegrationProvider, IntegrationWithSecret } from '@ape/api-contracts';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Loading,
  PageHeader,
  Select,
  Table,
  Td,
} from '@/components/ui';
import {
  useConnectGitHub,
  useCreateIntegration,
  useGitHubApp,
  useDeadLetters,
  useIntegrationAction,
  useIntegrations,
  useReplayDeadLetter,
  useWorkspace,
} from '@/lib/queries';
import { atLeast } from '@/lib/roles';

const PROVIDERS: Record<string, { name: string; hint: string }> = {
  otel_jaeger: {
    name: 'OpenTelemetry (Jaeger)',
    hint: 'Pulls error traces for your mapped services.',
  },
  deploy_webhook: { name: 'Deploy webhook', hint: 'Your CI posts a signed event on every deploy.' },
};
const ADDABLE: IntegrationProvider[] = ['otel_jaeger', 'deploy_webhook'];
const PROVIDER_NAMES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, v.name])),
  github: 'GitHub App',
};

function GitHubCard({ workspaceId }: { workspaceId: string }) {
  const info = useGitHubApp(workspaceId, true);
  const connect = useConnectGitHub(workspaceId);
  if (info.isPending) return null;
  return (
    <Card className="mb-6 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">GitHub</p>
          <p className="text-sm text-subtle">
            Lets the platform read code and history of your mapped repos with short-lived tokens. It
            never pushes without an approved fix.
          </p>
        </div>
        {info.data?.installUrl && (
          <a href={info.data.installUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary">Install on GitHub ↗</Button>
          </a>
        )}
      </div>
      <ErrorBox error={info.error} />
      {info.data && !info.data.configured && (
        <p className="mt-3 text-sm text-warn">
          The API has no GitHub App configured (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY_PATH).
        </p>
      )}
      {info.data?.configured && (
        <div className="mt-4">
          {info.data.installations.length === 0 ? (
            <p className="text-sm text-subtle">
              No unconnected installations. Install the App on your account (choose the
              repositories), then{' '}
              <button className="text-accent underline" onClick={() => void info.refetch()}>
                refresh
              </button>
              .
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {info.data.installations.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{i.account}</span>
                    <span className="text-subtle">
                      {' '}
                      ·{' '}
                      {i.repositorySelection === 'all'
                        ? 'all repositories'
                        : 'selected repositories'}
                    </span>
                  </span>
                  <Button
                    className="h-8"
                    disabled={connect.isPending}
                    onClick={() => connect.mutate(i.id)}
                  >
                    Connect
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2">
            <ErrorBox error={connect.error} />
          </div>
        </div>
      )}
    </Card>
  );
}

function SecretOnce({ created, onClose }: { created: IntegrationWithSecret; onClose: () => void }) {
  return (
    <Card className="mb-6 border-warn/50 p-4">
      <p className="font-medium">Copy this signing secret now. It won’t be shown again.</p>
      <dl className="mt-3 grid gap-2 text-sm">
        <dt className="text-subtle">Webhook URL</dt>
        <dd className="font-mono text-xs break-all select-all">{created.webhookUrl}</dd>
        <dt className="text-subtle">Signing secret</dt>
        <dd className="font-mono text-xs break-all select-all">{created.signingSecret}</dd>
      </dl>
      <p className="mt-3 text-xs text-subtle">
        For demo-shop, set <code>PLATFORM_DEPLOY_WEBHOOK_URL</code> and{' '}
        <code>PLATFORM_DEPLOY_WEBHOOK_SECRET</code> and run <code>pnpm deploy-marker</code>.
        Requests are signed with HMAC-SHA256 over <code>timestamp.body</code>.
      </p>
      <Button className="mt-4" variant="secondary" onClick={onClose}>
        I’ve saved it
      </Button>
    </Card>
  );
}

export default function IntegrationsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ws = useWorkspace(workspaceId);
  const isAdmin = atLeast(ws.data?.role, 'admin');
  const integrations = useIntegrations(workspaceId);
  const create = useCreateIntegration(workspaceId);
  const action = useIntegrationAction(workspaceId);
  const deadLetters = useDeadLetters(workspaceId, isAdmin);
  const replay = useReplayDeadLetter(workspaceId);
  const [provider, setProvider] = useState<IntegrationProvider>('otel_jaeger');
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<IntegrationWithSecret | null>(null);

  const add = async () => {
    const created = await create.mutateAsync({
      provider,
      name: name.trim() || PROVIDERS[provider]!.name,
    });
    setName('');
    if (created.signingSecret) setSecret(created);
  };

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Integrations"
        description="Where incidents and deploy events come from. Health updates live."
      />
      {secret && <SecretOnce created={secret} onClose={() => setSecret(null)} />}

      {isAdmin && <GitHubCard workspaceId={workspaceId} />}

      {isAdmin && (
        <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
          <Field label="Add integration">
            <Select
              value={provider}
              onChange={(e) => setProvider(e.target.value as IntegrationProvider)}
            >
              {ADDABLE.map((k) => (
                <option key={k} value={k}>
                  {PROVIDERS[k]!.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="min-w-48 flex-1">
            <Field label="Name">
              <Input
                placeholder={PROVIDERS[provider]!.name}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </div>
          <Button onClick={() => void add()} disabled={create.isPending}>
            Connect
          </Button>
          <p className="w-full text-xs text-subtle">{PROVIDERS[provider]!.hint}</p>
          <ErrorBox error={create.error} />
        </Card>
      )}

      <Card>
        {integrations.isPending ? (
          <Loading />
        ) : !integrations.data?.length ? (
          <EmptyState
            title="No integrations yet"
            hint="Connect OpenTelemetry to start detecting incidents."
          />
        ) : (
          <Table head={['Integration', 'Status', 'Last sync', 'Details', '']}>
            {integrations.data.map((it) => (
              <tr key={it.id} className="align-top">
                <Td>
                  <p className="font-medium">{it.name}</p>
                  <p className="text-xs text-subtle">
                    {PROVIDER_NAMES[it.provider] ?? it.provider}
                  </p>
                </Td>
                <Td>
                  <Badge tone={it.status}>{it.status}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-subtle">
                  {it.lastSyncAt ? new Date(it.lastSyncAt).toLocaleString() : 'Never'}
                </Td>
                <Td className="max-w-sm text-xs">
                  <p className="text-subtle">{it.scope}</p>
                  {it.webhookUrl && it.status !== 'disconnected' && (
                    <p className="mt-1 font-mono break-all">{it.webhookUrl}</p>
                  )}
                  {it.lastError && <p className="mt-1 text-danger">{it.lastError}</p>}
                </Td>
                <Td className="text-right">
                  {isAdmin && it.status !== 'disconnected' && (
                    <div className="flex justify-end gap-2">
                      {(it.provider === 'otel_jaeger' || it.provider === 'github') && (
                        <Button
                          variant="secondary"
                          className="h-8"
                          onClick={() => action.mutate({ id: it.id, action: 'test' })}
                        >
                          Test
                        </Button>
                      )}
                      {it.provider === 'deploy_webhook' && (
                        <Button
                          variant="secondary"
                          className="h-8"
                          onClick={() =>
                            action.mutate(
                              { id: it.id, action: 'rotate-secret' },
                              { onSuccess: (r) => r && setSecret(r) },
                            )
                          }
                        >
                          Rotate secret
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        className="h-8"
                        onClick={() => action.mutate({ id: it.id, action: 'disconnect' })}
                      >
                        Disconnect
                      </Button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <div className="mt-3">
        <ErrorBox error={action.error} />
      </div>

      {isAdmin && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-semibold">Dead-lettered events</h2>
          <Card>
            {!deadLetters.data?.length ? (
              <EmptyState
                title="Nothing quarantined"
                hint="Events that keep failing to process land here with a reason."
              />
            ) : (
              <Table head={['Received', 'Source', 'Reason', 'Error', '']}>
                {deadLetters.data.map((d) => (
                  <tr key={d.id}>
                    <Td className="whitespace-nowrap text-subtle">
                      {new Date(d.receivedAt).toLocaleString()}
                    </Td>
                    <Td className="text-xs">{d.source}</Td>
                    <Td>
                      <Badge tone="failure">{d.deadReason}</Badge>
                    </Td>
                    <Td className="max-w-md truncate text-xs text-subtle">{d.lastError}</Td>
                    <Td className="text-right">
                      <Button variant="ghost" className="h-8" onClick={() => replay.mutate(d.id)}>
                        Replay
                      </Button>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
