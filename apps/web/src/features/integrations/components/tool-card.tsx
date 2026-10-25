'use client';

import type { ToolAlertsEnabled, ToolView } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeSnippet } from '@/components/ui/code-snippet';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { ToolAutoSetup } from '@/features/setup/components/tool-auto-setup';
import { readerBody, TOOL_FIELDS } from '../tool-fields';
import { TOOL_MONOGRAM } from '../ways';

function Switch({
  id,
  checked,
  disabled,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  description: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-5">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-6 w-10 flex-none rounded-full border border-line-strong bg-surface-sunken transition-colors after:absolute after:left-[3px] after:top-[3px] after:size-4 after:rounded-full after:bg-ink-muted after:transition-transform peer-checked:border-brand peer-checked:bg-brand peer-checked:after:translate-x-4 peer-checked:after:bg-on-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:opacity-50"
      />
      <span className="min-w-0">
        <span className="font-semibold">{label}</span>
        <span className="block text-[13px] text-ink-muted">{description}</span>
      </span>
    </label>
  );
}

/** A tool the team already uses. Way 6: its alerts open incidents. Way 7: the AI reads its data. */
export function ToolCard({ tool }: { tool: ToolView }) {
  const { workspace, can } = useSession();
  const admin = can('admin');
  const qc = useQueryClient();
  const base = `/workspaces/${workspace.id}/tools/${tool.id}`;
  const [setup, setSetup] = useState<ToolAlertsEnabled | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['ws', workspace.id, 'tools'] });

  const alerts = useMutation({
    mutationFn: (enabled: boolean) =>
      api<ToolAlertsEnabled>(`${base}/alerts`, { method: 'PUT', json: { enabled } }),
    onSuccess: (res) => {
      setError(null);
      if (res.token) setSetup(res);
      void refresh();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const test = useMutation({
    mutationFn: () => api<ToolView>(`${base}/reader/test`, { method: 'POST' }),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  });
  const disconnect = useMutation({
    mutationFn: () => api<ToolView>(`${base}/reader`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  });

  const connected = tool.alerts.enabled || tool.reader.status !== 'not_connected';
  const reading = tool.reader.status !== 'not_connected';

  return (
    <article className="grid min-w-0 content-start gap-3 rounded-lg border border-line bg-surface-raised p-6 shadow-raised max-sm:p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 flex-none place-items-center rounded-md bg-info-soft font-display text-[15px] font-bold text-info">
          {TOOL_MONOGRAM[tool.id]}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold leading-[22px]">{tool.name}</h3>
          <p className="m-0 text-[13px] leading-5 text-ink-muted">{tool.description}</p>
        </div>
        {tool.reader.status === 'error' ? (
          <Badge tone="danger">Check access</Badge>
        ) : connected ? (
          <Badge tone="ok">Connected</Badge>
        ) : (
          <Badge>Not connected</Badge>
        )}
      </div>
      <div className="grid gap-3">
        <Switch
          id={`${tool.id}-alerts`}
          checked={tool.alerts.enabled}
          disabled={!admin || alerts.isPending}
          onChange={(v) =>
            (v ||
              window.confirm(
                `Stop accepting alerts from ${tool.name}? Its webhook stops working.`,
              )) &&
            alerts.mutate(v)
          }
          label={
            <>
              Send alerts to us <span className="ml-1 font-normal text-ink-muted">· Way 6</span>
            </>
          }
          description={
            tool.alerts.enabled
              ? tool.alerts.lastReceivedAt
                ? `Last alert ${formatAgo(tool.alerts.lastReceivedAt)}.`
                : 'Waiting for the first alert.'
              : 'An alert opens an incident here.'
          }
        />
        <Switch
          id={`${tool.id}-read`}
          checked={reading}
          disabled={!admin || disconnect.isPending}
          onChange={(v) =>
            v
              ? setConnectOpen(true)
              : window.confirm(`Remove the ${tool.name} credentials? The AI stops reading it.`) &&
                disconnect.mutate()
          }
          label={
            <>
              Let the AI read {tool.readsWhat}{' '}
              <span className="ml-1 font-normal text-ink-muted">· Way 7</span>
            </>
          }
          description="Read-only, and only during an investigation."
        />
      </div>
      {tool.reader.status === 'error' && tool.reader.lastError && (
        <FormError>{tool.reader.lastError}</FormError>
      )}
      {tool.alerts.lastError && <FormError>{tool.alerts.lastError}</FormError>}
      <FormError>{error}</FormError>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-[13px] text-ink-muted">
          {reading
            ? tool.reader.lastUsedAt
              ? `Last used by the AI ${formatAgo(tool.reader.lastUsedAt)}`
              : 'Not used by the AI yet'
            : 'Needs a read-only API key'}
        </span>
        {admin &&
          (reading ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => test.mutate()}
                disabled={test.isPending}
              >
                {test.isPending ? 'Testing…' : 'Test'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConnectOpen(true)}>
                Manage
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <ToolAutoSetup tool={tool.id} name={tool.name} />
              <Button size="sm" variant="secondary" onClick={() => setConnectOpen(true)}>
                Use a read-only key
              </Button>
            </div>
          ))}
      </div>

      <ConnectDialog
        tool={tool}
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onSaved={() => void refresh()}
      />

      <Dialog
        open={Boolean(setup)}
        onClose={() => setSetup(null)}
        title={`Send ${tool.name} alerts here`}
        description="The token is shown once. Paste it into the tool now."
        wide
      >
        {setup && (
          <div className="grid gap-3">
            <CodeSnippet label="Webhook URL" code={setup.url} wrap />
            {setup.token && <CodeSnippet label="Token" code={setup.token} />}
            <CodeSnippet label="Setup" code={setup.setup} wrap />
            <div className="flex justify-end">
              <Button onClick={() => setSetup(null)}>Done</Button>
            </div>
          </div>
        )}
      </Dialog>
    </article>
  );
}

function ConnectDialog({
  tool,
  open,
  onClose,
  onSaved,
}: {
  tool: ToolView;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { workspace } = useSession();
  const spec = TOOL_FIELDS[tool.id];
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolView | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<ToolView>(`/workspaces/${workspace.id}/tools/${tool.id}/reader`, {
        method: 'PUT',
        json: body,
      }),
    onSuccess: (view) => {
      setResult(view);
      onSaved();
      if (view.reader.status === 'connected') onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Connect ${tool.name} (read-only)`}
      description={spec.help}
    >
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setResult(null);
          save.mutate(readerBody(tool.id, new FormData(e.currentTarget)));
        }}
      >
        {spec.fields.map((f) => (
          <Field key={f.name} id={`${tool.id}-${f.name}`} label={f.label} hint={f.hint}>
            {f.type === 'select' ? (
              <Select
                id={`${tool.id}-${f.name}`}
                name={f.name}
                defaultValue={tool.reader.settings[f.name] ?? f.options?.[0]?.value}
              >
                {f.options!.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id={`${tool.id}-${f.name}`}
                name={f.name}
                type={f.type === 'password' ? 'password' : f.type === 'url' ? 'url' : 'text'}
                autoComplete="off"
                placeholder={
                  f.type === 'password' && tool.reader.status !== 'not_connected'
                    ? 'Saved. Enter again to change.'
                    : f.placeholder
                }
                defaultValue={f.type === 'password' ? undefined : tool.reader.settings[f.name]}
                required={f.required}
              />
            )}
          </Field>
        ))}
        {result?.reader.status === 'error' && (
          <FormError>Saved, but the test query failed: {result.reader.lastError}</FormError>
        )}
        <FormError>{error}</FormError>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Testing…' : 'Save and test'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
