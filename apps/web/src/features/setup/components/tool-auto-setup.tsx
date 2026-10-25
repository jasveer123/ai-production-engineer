'use client';

import type { AutoSetupResult, AwsSetupStart, ToolId } from '@ape/api-contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CodeSnippet } from '@/components/ui/code-snippet';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { startOAuth, useSetupCapabilities } from '../queries';
import { LocalUrlWarning } from './local-url-warning';
import { ResultList } from './result-list';

type FieldSpec = {
  name: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  options?: string[];
};

/** Admin credentials used once to configure the tool; only the read-only result is stored. */
const AUTO: Partial<Record<ToolId, { help: string; fields: FieldSpec[] }>> = {
  grafana: {
    help: 'A service account token with the Editor role. We create the alert contact point and a policy route, and read Loki through Grafana.',
    fields: [
      {
        name: 'url',
        label: 'Grafana URL',
        placeholder: 'https://acme.grafana.net',
        required: true,
      },
      { name: 'token', label: 'Service account token (Editor)', secret: true, required: true },
      {
        name: 'serviceLabel',
        label: 'Loki label with the service name',
        placeholder: 'service_name',
      },
    ],
  },
  datadog: {
    help: 'We create the "@webhook-ape" webhook and read logs. The application key needs create_webhooks and logs_read_data.',
    fields: [
      {
        name: 'site',
        label: 'Datadog site',
        options: [
          'datadoghq.com',
          'us3.datadoghq.com',
          'us5.datadoghq.com',
          'datadoghq.eu',
          'ap1.datadoghq.com',
          'ddog-gov.com',
        ],
      },
      { name: 'apiKey', label: 'API key', secret: true, required: true },
      { name: 'appKey', label: 'Application key', secret: true, required: true },
    ],
  },
  elasticsearch: {
    help: 'An admin API key, used once: we create a read-only key for your log indices and a Kibana webhook connector. The admin key is not stored.',
    fields: [
      {
        name: 'url',
        label: 'Elasticsearch URL',
        placeholder: 'https://es.example.com:9200',
        required: true,
      },
      {
        name: 'kibanaUrl',
        label: 'Kibana URL (for alerts)',
        placeholder: 'https://kibana.example.com',
      },
      { name: 'adminApiKey', label: 'Admin API key (encoded)', secret: true, required: true },
      { name: 'index', label: 'Log index pattern', placeholder: 'logs-*' },
      { name: 'serviceField', label: 'Field with the service name', placeholder: 'service.name' },
    ],
  },
  betterstack: {
    help: 'A global Telemetry API token. We create a read-only query connection. Better Stack only allows the alert webhook in its UI.',
    fields: [
      { name: 'apiToken', label: 'Global API token', secret: true, required: true },
      {
        name: 'sourceName',
        label: 'Source name (optional)',
        hint: 'The first source is used when empty.',
      },
    ],
  },
};

export function ToolAutoSetup({ tool, name }: { tool: ToolId; name: string }) {
  const { workspace, can } = useSession();
  const caps = useSetupCapabilities();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ done: string[]; todo: string[] } | null>(null);
  const [aws, setAws] = useState<AwsSetupStart | null>(null);
  if (!can('admin')) return null;

  const spec = AUTO[tool];
  const refresh = () => qc.invalidateQueries({ queryKey: ['ws', workspace.id, 'tools'] });
  const close = () => {
    setOpen(false);
    setResult(null);
    setError(null);
    void refresh();
  };

  if (tool === 'sentry') {
    if (!caps.data?.oauth.sentry) return null;
    return (
      <>
        <Button
          size="sm"
          onClick={() =>
            void startOAuth(workspace.id, 'sentry').catch((e: unknown) => setError(errorMessage(e)))
          }
        >
          Connect with Sentry
        </Button>
        <FormError>{error}</FormError>
      </>
    );
  }

  if (tool === 'cloudwatch') {
    return (
      <>
        <Button
          size="sm"
          onClick={async () => {
            setOpen(true);
            setError(null);
            try {
              setAws(
                await api<AwsSetupStart>(`/workspaces/${workspace.id}/setup/aws`, {
                  method: 'POST',
                }),
              );
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          Set up automatically
        </Button>
        <Dialog
          open={open}
          onClose={close}
          title="Set up CloudWatch with one command"
          description="Run it where the AWS CLI is signed in to the right account. It creates a read-only user and an alarm topic, then sends us the read-only key."
          wide
        >
          <div className="grid gap-3">
            <LocalUrlWarning />
            {aws ? (
              <>
                <CodeSnippet label="Terminal (works once, for 2 hours)" code={aws.command} />
                <p className="m-0 text-[13px] text-ink-muted">
                  When the stack finishes, this card shows Connected. Then point your CloudWatch
                  alarms (ALARM and OK actions) at the topic in the stack outputs.
                </p>
              </>
            ) : (
              !error && <p className="m-0 text-ink-muted">Preparing the command…</p>
            )}
            <FormError>{error}</FormError>
            <div className="flex justify-end">
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        </Dialog>
      </>
    );
  }

  if (!spec) return null;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Set up automatically
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={`Set up ${name} automatically`}
        description={spec.help}
        wide
      >
        {result ? (
          <div className="grid gap-3">
            <ResultList done={result.done} todo={result.todo} />
            <div className="flex justify-end">
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const body: Record<string, string> = { tool };
              for (const field of spec.fields) {
                const v = String(f.get(field.name) ?? '').trim();
                if (v) body[field.name] = v;
              }
              setPending(true);
              setError(null);
              try {
                const r = await api<AutoSetupResult>(`/workspaces/${workspace.id}/setup/tools`, {
                  method: 'POST',
                  json: body,
                });
                setResult({ done: r.done, todo: r.todo });
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setPending(false);
              }
            }}
          >
            <LocalUrlWarning />
            {spec.fields.map((field) => (
              <Field
                key={field.name}
                id={`auto-${tool}-${field.name}`}
                label={field.label}
                hint={field.hint}
              >
                {field.options ? (
                  <Select id={`auto-${tool}-${field.name}`} name={field.name}>
                    {field.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id={`auto-${tool}-${field.name}`}
                    name={field.name}
                    type={field.secret ? 'password' : 'text'}
                    autoComplete="off"
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                )}
              </Field>
            ))}
            <FormError>{error}</FormError>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Setting up…' : 'Set it up'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
