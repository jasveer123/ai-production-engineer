'use client';

import type { AlertPreview, AlertRoute, AlertSource } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, FormError, Select } from '@/components/ui/form';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useSession } from '@/features/auth/session';
import { SeverityBadge } from '@/features/incidents/components/incident-badges';
import { api, errorMessage } from '@/lib/api';
import { alertsKey, useAlertRoutes, useAlertSources } from '../queries';
import { describeConditions, moveRoute, SAMPLE_HTTP_ALERT } from '../setup';
import { RouteDialog } from './route-dialog';

export function RoutesView() {
  const { workspace, can } = useSession();
  const ws = workspace.id;
  const qc = useQueryClient();
  const isAdmin = can('admin');
  const routes = useAlertRoutes();
  const sources = useAlertSources();
  const [editing, setEditing] = useState<null | 'new' | AlertRoute>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: alertsKey(ws) });
  const sourceName = (id: string) =>
    sources.data?.find((s) => s.id === id)?.name ?? 'removed source';

  const reorder = useMutation({
    mutationFn: (ids: string[]) =>
      api<AlertRoute[]>(`/workspaces/${ws}/alert-routes/order`, { method: 'PUT', json: { ids } }),
    onSuccess: () => (setActionError(null), refresh()),
    onError: (e) => setActionError(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/workspaces/${ws}/alert-routes/${id}`, { method: 'DELETE' }),
    onSuccess: () => (setActionError(null), refresh()),
    onError: (e) => setActionError(errorMessage(e)),
  });

  const addButton = isAdmin ? <Button onClick={() => setEditing('new')}>Add route</Button> : null;
  const list = routes.data ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-[62ch] text-[13px] text-ink-muted">
          Routes are checked top to bottom and the first match wins. Alerts that match no route are
          kept on the Alerts tab, never dropped.
        </p>
        {addButton ?? (
          <span className="text-[13px] text-ink-muted">Only admins can change routes.</span>
        )}
      </div>
      {actionError && (
        <Banner tone="danger" title="That did not work.">
          {actionError}
        </Banner>
      )}

      {routes.isPending ? (
        <p className="text-ink-muted">Loading routes…</p>
      ) : routes.isError ? (
        <Banner tone="danger" title="Could not load routes.">
          {errorMessage(routes.error)}
        </Banner>
      ) : list.length === 0 ? (
        <EmptyState icon="list" title="No routes yet" action={addButton}>
          Without a route, alerts are recorded but never open an incident. Add one that matches the
          alerts you care about.
        </EmptyState>
      ) : (
        <Card as="section">
          <CardHeader
            eyebrow="Routes"
            title="What happens to a new alert"
            aside={<span className="text-[13px] text-ink-muted">First match wins</span>}
          />
          <ol className="mt-3">
            {list.map((r, i) => (
              <li
                key={r.id}
                className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 border-t border-line py-3 first:border-t-0 sm:grid-cols-[28px_minmax(0,1fr)_auto]"
              >
                <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-strong">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {r.name}
                    {!r.enabled && <Badge tone="neutral">Paused</Badge>}
                  </div>
                  <div className="text-[13px] text-ink-muted">
                    From{' '}
                    {r.sourceIds.length ? r.sourceIds.map(sourceName).join(', ') : 'any source'},
                    {r.conditions.length
                      ? ` when ${describeConditions(r.conditions)}`
                      : ' every alert'}{' '}
                    →{' '}
                    {r.createIncident
                      ? `open an incident${r.incidentSeverity ? ` (${r.incidentSeverity})` : ''}`
                      : 'record only'}
                    {r.groupBy.length > 0 && `, grouped by ${r.groupBy.join(', ')}`}
                  </div>
                </div>
                {isAdmin && (
                  <div className="col-start-2 flex flex-wrap gap-1 sm:col-start-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Move ${r.name} up`}
                      disabled={i === 0 || reorder.isPending}
                      onClick={() => reorder.mutate(moveRoute(list, i, -1))}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Move ${r.name} down`}
                      disabled={i === list.length - 1 || reorder.isPending}
                      onClick={() => reorder.mutate(moveRoute(list, i, 1))}
                    >
                      ↓
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={remove.isPending}
                      onClick={() =>
                        window.confirm(`Delete the route ${r.name}?`) && remove.mutate(r.id)
                      }
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {isAdmin && sources.data && sources.data.length > 0 && (
        <PreviewCard workspaceId={ws} sources={sources.data} />
      )}

      {isAdmin && editing && (
        <RouteDialog
          key={editing === 'new' ? 'new' : editing.id}
          route={editing === 'new' ? null : editing}
          sources={sources.data ?? []}
          workspaceId={ws}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </>
  );
}

function PreviewCard({ workspaceId, sources }: { workspaceId: string; sources: AlertSource[] }) {
  const [payload, setPayload] = useState(JSON.stringify(SAMPLE_HTTP_ALERT, null, 2));
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const preview = useMutation({
    mutationFn: (body: { sourceId: string; payload: unknown }) =>
      api<AlertPreview>(`/workspaces/${workspaceId}/alert-routes/preview`, {
        method: 'POST',
        json: body,
      }),
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Card as="section">
      <CardHeader eyebrow="Test a payload" title="Where would this alert go?" />
      <form
        className="mt-3 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          let parsed: unknown;
          try {
            parsed = JSON.parse(payload);
          } catch {
            setError('That is not valid JSON.');
            return;
          }
          preview.mutate({ sourceId, payload: parsed });
        }}
      >
        <Field
          id="preview-source"
          label="As if sent to"
          hint="The payload is parsed in this source's format."
        >
          <Select
            id="preview-source"
            aria-describedby="preview-source-msg"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="preview-payload" label="Payload (JSON)">
          <textarea
            id="preview-payload"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full min-w-0 rounded-md border border-line-strong bg-surface-raised p-3 font-mono text-[13px] text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-brand"
          />
        </Field>
        <FormError>{error ?? preview.data?.error}</FormError>
        <div>
          <Button type="submit" variant="secondary" disabled={preview.isPending}>
            {preview.isPending ? 'Testing…' : 'Test payload'}
          </Button>
        </div>
      </form>
      {preview.data && preview.data.alerts.length > 0 && (
        <div className="mt-3">
          <Table label="Preview result">
            <thead>
              <tr>
                <Th>Alert</Th>
                <Th>Severity</Th>
                <Th>Route</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {preview.data.alerts.map((a) => (
                <Tr key={a.dedupKey}>
                  <Td>
                    <div className="font-semibold">{a.title}</div>
                    <div className="text-[13px] text-ink-muted">{a.status}</div>
                  </Td>
                  <Td>
                    <SeverityBadge severity={a.severity} />
                  </Td>
                  <Td className="text-[13px]">{a.route?.name ?? 'No route matches'}</Td>
                  <Td className="text-[13px] text-ink-muted">
                    {a.createsIncident ? 'Opens or joins an incident' : 'Recorded only'}
                    {a.groupKey && <div className="font-mono">group {a.groupKey}</div>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Card>
  );
}
