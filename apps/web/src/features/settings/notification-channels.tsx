'use client';

import {
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_EVENTS,
  SEVERITIES,
  type CreateNotificationChannelInput,
  type NotificationChannel,
  type NotificationChannelWithSecret,
  type NotificationEvent,
  type NotificationTestResult,
  type Severity,
  type UpdateNotificationChannelInput,
} from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { CodeSnippet } from '@/components/ui/code-snippet';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useNotificationChannels, useNotificationDeliveries } from './queries';

const KIND_LABEL = { slack: 'Slack', webhook: 'Webhook' } as const;

type Editing = null | 'new' | NotificationChannel;

export function NotificationChannels() {
  const { workspace, can } = useSession();
  const ws = workspace.id;
  const qc = useQueryClient();
  const isAdmin = can('admin');
  const channels = useNotificationChannels();
  const [editing, setEditing] = useState<Editing>(null);
  const [secret, setSecret] = useState<NotificationChannelWithSecret | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['ws', ws, 'notifications'] });
  const base = `/workspaces/${ws}/notifications/channels`;
  const fail = (e: unknown) => setNotice({ ok: false, text: errorMessage(e) });

  const toggle = useMutation({
    mutationFn: (c: NotificationChannel) =>
      api(`${base}/${c.id}`, { method: 'PATCH', json: { enabled: !c.enabled } }),
    onSuccess: () => (setNotice(null), refresh()),
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`${base}/${id}`, { method: 'DELETE' }),
    onSuccess: () => (setNotice(null), refresh()),
    onError: fail,
  });
  const test = useMutation({
    mutationFn: (c: NotificationChannel) =>
      api<NotificationTestResult>(`${base}/${c.id}/test`, { method: 'POST' }).then((r) => ({
        c,
        r,
      })),
    onSuccess: ({ c, r }) => {
      setNotice(
        r.ok
          ? {
              ok: true,
              text: `Test message sent to ${c.name}${r.status ? ` (HTTP ${r.status})` : ''}.`,
            }
          : {
              ok: false,
              text: `${c.name} did not accept the test${r.status ? ` (HTTP ${r.status})` : ''}: ${r.error ?? 'no reason given'}.`,
            },
      );
      void refresh();
    },
    onError: fail,
  });

  const addButton = isAdmin ? (
    <Button size="sm" onClick={() => setEditing('new')}>
      Add channel
    </Button>
  ) : null;

  return (
    <>
      <Card as="section" className="grid gap-4">
        <CardHeader
          eyebrow="Notifications"
          title="Where we tell you about incidents"
          aside={
            addButton ?? (
              <span className="text-[13px] text-ink-muted">Only admins can change channels.</span>
            )
          }
        />
        {notice && (
          <Banner
            tone={notice.ok ? 'ok' : 'danger'}
            title={notice.ok ? 'Done.' : 'That did not work.'}
          >
            {notice.text}
          </Banner>
        )}
        {channels.isPending ? (
          <p className="m-0 text-ink-muted">Loading channels…</p>
        ) : channels.isError ? (
          <Banner tone="danger" title="Could not load notification channels.">
            {errorMessage(channels.error)}
          </Banner>
        ) : channels.data.length === 0 ? (
          <p className="m-0 text-sm text-ink-muted">
            No channels yet, so nobody is told about new incidents.{' '}
            {isAdmin
              ? 'Add a Slack incoming webhook or your own HTTPS endpoint.'
              : 'An admin can add a Slack channel or a webhook.'}
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {channels.data.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0"
              >
                <Badge tone="info" icon={null}>
                  {KIND_LABEL[c.kind]}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{c.name}</div>
                  <div className="truncate font-mono text-[13px] text-ink-muted">{c.target}</div>
                  <div className="text-[13px] text-ink-muted">
                    {c.events.length} of {NOTIFICATION_EVENTS.length} events, {c.minSeverity} and
                    above · last sent {formatAgo(c.lastDeliveryAt)}
                  </div>
                  {c.lastError && (
                    <div className="text-[13px] text-danger">Last error: {c.lastError}</div>
                  )}
                </div>
                {c.enabled ? <Badge tone="ok">Active</Badge> : <Badge tone="warn">Paused</Badge>}
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={test.isPending}
                      onClick={() => test.mutate(c)}
                    >
                      {test.isPending && test.variables?.id === c.id ? 'Sending…' : 'Send test'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate(c)}
                    >
                      {c.enabled ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={remove.isPending}
                      onClick={() =>
                        window.confirm(`Delete ${c.name}? It stops receiving messages at once.`) &&
                        remove.mutate(c.id)
                      }
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 text-[13px] text-ink-muted">
          Messages contain the incident title, severity, status and a link. Never code, stack traces
          or evidence.
        </p>
      </Card>

      {isAdmin && <RecentDeliveries />}

      {isAdmin && editing && (
        <ChannelDialog
          key={editing === 'new' ? 'new' : editing.id}
          channel={editing === 'new' ? null : editing}
          base={base}
          onClose={() => setEditing(null)}
          onSaved={(created) => {
            setEditing(null);
            setNotice(null);
            if (created?.signingSecret) setSecret(created);
            void refresh();
          }}
        />
      )}

      <Dialog
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title="Save this signing secret"
        description="It is shown once. Your endpoint verifies the x-ape-signature header with it."
        wide
      >
        {secret && (
          <div className="grid gap-3">
            <CodeSnippet
              label={`Signing secret for ${secret.name}`}
              code={secret.signingSecret ?? ''}
            />
            <div className="flex justify-end">
              <Button onClick={() => setSecret(null)}>Done</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

function RecentDeliveries() {
  const deliveries = useNotificationDeliveries(true);
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="m-0 font-display text-base font-semibold">Recent deliveries</h2>
        <p className="m-0 text-[13px] text-ink-muted">
          Each message we tried to send, and what the channel answered.
        </p>
      </div>
      {deliveries.isPending ? (
        <p className="m-0 text-ink-muted">Loading deliveries…</p>
      ) : deliveries.isError ? (
        <Banner tone="danger" title="Could not load deliveries.">
          {errorMessage(deliveries.error)}
        </Banner>
      ) : deliveries.data.length === 0 ? (
        <p className="m-0 text-sm text-ink-muted">
          Nothing sent yet. Use Send test to try a channel.
        </p>
      ) : (
        <Table label="Recent notification deliveries">
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Channel</Th>
              <Th>Event</Th>
              <Th>Result</Th>
            </tr>
          </thead>
          <tbody>
            {deliveries.data.map((d) => (
              <Tr key={d.id}>
                <Td className="whitespace-nowrap text-[13px] text-ink-muted">
                  {formatDateTime(d.createdAt)} UTC
                </Td>
                <Td className="font-semibold">{d.channelName}</Td>
                <Td className="text-[13px]">
                  {NOTIFICATION_EVENT_LABELS[d.eventType as NotificationEvent] ?? d.eventType}
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    {d.status === 'sent' ? (
                      <Badge tone="ok">Sent</Badge>
                    ) : (
                      <Badge tone="danger">Failed</Badge>
                    )}
                    <span className="text-[13px] text-ink-muted">
                      {d.responseStatus ? `HTTP ${d.responseStatus}` : ''}
                      {d.attempts > 1 ? ` · ${d.attempts} attempts` : ''}
                    </span>
                  </div>
                  {d.error && <div className="text-[13px] text-danger">{d.error}</div>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}

function ChannelDialog({
  channel,
  base,
  onClose,
  onSaved,
}: {
  channel: NotificationChannel | null;
  base: string;
  onClose: () => void;
  onSaved: (created: NotificationChannelWithSecret | null) => void;
}) {
  const [kind, setKind] = useState<'slack' | 'webhook'>(channel?.kind ?? 'slack');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: CreateNotificationChannelInput | UpdateNotificationChannelInput) =>
      channel
        ? api<NotificationChannel>(`${base}/${channel.id}`, { method: 'PATCH', json: body }).then(
            () => null,
          )
        : api<NotificationChannelWithSecret>(base, { method: 'POST', json: body }),
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={channel ? `Edit ${channel.name}` : 'Add a notification channel'}
      description="We post here when one of the chosen events happens to an incident at or above the severity you pick."
      wide
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const f = new FormData(e.currentTarget);
          const events = f.getAll('events') as NotificationEvent[];
          if (events.length === 0) return setError('Pick at least one event.');
          const common = {
            name: String(f.get('name')).trim(),
            events,
            minSeverity: String(f.get('minSeverity')) as Severity,
          };
          const url = String(f.get('url') ?? '').trim();
          save.mutate(
            channel
              ? common
              : kind === 'slack'
                ? { kind, ...common, webhookUrl: url }
                : { kind, ...common, url },
          );
        }}
      >
        {!channel && (
          <Field id="channel-kind" label="Type">
            <Select
              id="channel-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'slack' | 'webhook')}
            >
              <option value="slack">Slack incoming webhook</option>
              <option value="webhook">Webhook (your HTTPS endpoint, signed)</option>
            </Select>
          </Field>
        )}
        <Field id="channel-name" label="Name">
          <Input
            id="channel-name"
            name="name"
            required
            maxLength={80}
            defaultValue={channel?.name ?? ''}
            placeholder={kind === 'slack' ? '#incidents' : 'PagerDuty bridge'}
          />
        </Field>
        {!channel && (
          <Field
            id="channel-url"
            label={kind === 'slack' ? 'Slack webhook URL' : 'Endpoint URL'}
            hint={
              kind === 'slack'
                ? 'From a Slack app with Incoming Webhooks: https://hooks.slack.com/services/…'
                : 'We POST JSON signed with a secret you get after saving.'
            }
          >
            <Input
              id="channel-url"
              name="url"
              type="url"
              required
              maxLength={500}
              placeholder={
                kind === 'slack' ? 'https://hooks.slack.com/services/…' : 'https://example.com/hook'
              }
            />
          </Field>
        )}
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-1.5 text-[13px] font-semibold">Send a message when</legend>
          {NOTIFICATION_EVENTS.map((ev) => (
            <label key={ev} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="events"
                value={ev}
                defaultChecked={channel ? channel.events.includes(ev) : true}
                className="mt-0.5 size-4 accent-brand"
              />
              {NOTIFICATION_EVENT_LABELS[ev]}
            </label>
          ))}
        </fieldset>
        <Field id="channel-severity" label="Only for incidents at least this serious">
          <Select
            id="channel-severity"
            name="minSeverity"
            defaultValue={channel?.minSeverity ?? 'low'}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s === 'low' ? 'low (everything)' : s}
              </option>
            ))}
          </Select>
        </Field>
        {channel && (
          <p className="m-0 text-[13px] text-ink-muted">
            To change the URL, delete this channel and add it again.
          </p>
        )}
        <FormError>{error}</FormError>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : channel ? 'Save changes' : 'Add channel'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
