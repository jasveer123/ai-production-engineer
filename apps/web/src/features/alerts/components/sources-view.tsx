'use client';

import {
  ALERT_SOURCE_LABELS,
  type AlertSource,
  type AlertSourceKind,
  type AlertSourceWithToken,
} from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { alertsKey, useAlertSources } from '../queries';
import { CreateSourceDialog, RevealDialog } from './source-dialogs';

const STATUS_TONE: Record<AlertSource['status'], BadgeTone> = {
  pending: 'warn',
  connected: 'ok',
  error: 'danger',
  disconnected: 'neutral',
};
const STATUS_TEXT: Record<AlertSource['status'], string> = {
  pending: 'Waiting for first alert',
  connected: 'Receiving',
  error: 'Error',
  disconnected: 'Disconnected',
};
const BEAT_TONE = { pending: 'warn', up: 'ok', down: 'danger' } as const;
const BEAT_TEXT = { pending: 'Waiting for first ping', up: 'Up', down: 'Down' } as const;

const every = (s: number) =>
  s % 3600 === 0 ? `${s / 3600}h` : s % 60 === 0 ? `${s / 60}m` : `${s}s`;

export function SourcesView() {
  const { workspace, can } = useSession();
  const ws = workspace.id;
  const qc = useQueryClient();
  const isAdmin = can('admin');
  const sources = useAlertSources();
  const [creating, setCreating] = useState<AlertSourceKind | null>(null);
  const [revealed, setRevealed] = useState<AlertSourceWithToken | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: alertsKey(ws) });

  const rotate = useMutation({
    mutationFn: (id: string) =>
      api<AlertSourceWithToken>(`/workspaces/${ws}/alert-sources/${id}/rotate-token`, {
        method: 'POST',
      }),
    onSuccess: (s) => (setActionError(null), setRevealed(s), refresh()),
    onError: (e) => setActionError(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/workspaces/${ws}/alert-sources/${id}`, { method: 'DELETE' }),
    onSuccess: () => (setActionError(null), refresh()),
    onError: (e) => setActionError(errorMessage(e)),
  });

  const actions = (s: AlertSource) =>
    isAdmin && (
      <Td className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={rotate.isPending}
            onClick={() =>
              window.confirm(
                `Rotate the token for ${s.name}? The current one stops working right away.`,
              ) && rotate.mutate(s.id)
            }
          >
            Rotate token
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={remove.isPending}
            onClick={() =>
              window.confirm(
                `Delete ${s.name}? Its token stops working. Alerts already received stay.`,
              ) && remove.mutate(s.id)
            }
          >
            Delete
          </Button>
        </div>
      </Td>
    );

  const addButtons = isAdmin ? (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setCreating('http')}>Add alert source</Button>
      <Button variant="secondary" onClick={() => setCreating('heartbeat')}>
        Add heartbeat
      </Button>
    </div>
  ) : null;

  const tools = sources.data?.filter((s) => s.kind !== 'heartbeat') ?? [];
  const beats = sources.data?.filter((s) => s.kind === 'heartbeat') ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-[62ch] text-[13px] text-ink-muted">
          Each source gets its own URL and token. Heartbeats expect a ping on a schedule and fire an
          alert when one is missed.
        </p>
        {addButtons ?? (
          <span className="text-[13px] text-ink-muted">Only admins can change alert sources.</span>
        )}
      </div>
      {actionError && (
        <Banner tone="danger" title="That did not work.">
          {actionError}
        </Banner>
      )}

      {sources.isPending ? (
        <ListSkeleton label="Loading alert sources" />
      ) : sources.isError ? (
        <Banner tone="danger" title="Could not load alert sources.">
          {errorMessage(sources.error)}
        </Banner>
      ) : sources.data.length === 0 ? (
        <EmptyState icon="radio" title="No alert sources yet" action={addButtons}>
          {isAdmin
            ? 'Add Prometheus, Grafana, Sentry, Datadog or any tool that can POST JSON. You get a URL and token with ready-to-paste setup.'
            : 'An admin connects the tools that send alerts.'}
        </EmptyState>
      ) : (
        <>
          {tools.length > 0 && (
            <Table label="Alert sources">
              <thead>
                <tr>
                  <Th>Source</Th>
                  <Th>Status</Th>
                  <Th>Last alert</Th>
                  {isAdmin && <Th className="text-right">Actions</Th>}
                </tr>
              </thead>
              <tbody>
                {tools.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-[13px] text-ink-muted">
                        {ALERT_SOURCE_LABELS[s.kind]}
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[s.status]}>{STATUS_TEXT[s.status]}</Badge>
                      {s.lastError && (
                        <div className="mt-1 text-[13px] text-danger">{s.lastError}</div>
                      )}
                    </Td>
                    <Td className="text-[13px] text-ink-muted">{formatAgo(s.lastReceivedAt)}</Td>
                    {actions(s)}
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
          {beats.length > 0 && (
            <Table label="Heartbeats">
              <thead>
                <tr>
                  <Th>Heartbeat</Th>
                  <Th>State</Th>
                  <Th>Expected every</Th>
                  <Th>Last ping</Th>
                  {isAdmin && <Th className="text-right">Actions</Th>}
                </tr>
              </thead>
              <tbody>
                {beats.map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-semibold">{s.name}</Td>
                    <Td>
                      {s.heartbeat && (
                        <Badge tone={BEAT_TONE[s.heartbeat.state]}>
                          {BEAT_TEXT[s.heartbeat.state]}
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-[13px] text-ink-muted">
                      {s.heartbeat &&
                        `${every(s.heartbeat.intervalSeconds)} + ${every(s.heartbeat.graceSeconds)} grace`}
                    </Td>
                    <Td className="text-[13px] text-ink-muted">
                      {formatAgo(s.heartbeat?.lastPingAt ?? null)}
                    </Td>
                    {actions(s)}
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}

      {isAdmin && creating && (
        <CreateSourceDialog
          heartbeat={creating === 'heartbeat'}
          workspaceId={ws}
          onClose={() => setCreating(null)}
          onCreated={(s) => {
            setCreating(null);
            setRevealed(s);
            void refresh();
          }}
        />
      )}
      {revealed && <RevealDialog source={revealed} onClose={() => setRevealed(null)} />}
    </>
  );
}
