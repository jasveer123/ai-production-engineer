'use client';

import {
  NOTIFICATION_EVENTS,
  type NotificationChannel,
  type NotificationChannelWithSecret,
  type NotificationTestResult,
} from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { CodeSnippet } from '@/components/ui/code-snippet';
import { Dialog } from '@/components/ui/dialog';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { ChannelDialog } from './components/channel-dialog';
import { RecentDeliveries } from './components/recent-deliveries';
import { settingsKeys, useNotificationChannels } from './queries';

const KIND_LABEL = { slack: 'Slack', webhook: 'Webhook' } as const;

/** `null` closed, 'new' adding, a channel editing it. */
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
  const refresh = () => qc.invalidateQueries({ queryKey: settingsKeys.notifications(ws) });
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
          <ListSkeleton label="Loading channels" />
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
