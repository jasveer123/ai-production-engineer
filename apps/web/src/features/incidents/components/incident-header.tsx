'use client';

import type { Incident, IncidentStatus } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Select } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { formatAgo, formatCount, formatDateTime } from '@/lib/format';
import { manualNextStatuses, STATUS_META } from '../live';
import { incidentKeys, useIncident } from '../queries';
import { SeverityBadge } from './incident-badges';
import { IncidentStatusBadge } from './incident-status-badge';

/** Title, severity, status, service and timestamps for one incident (FRD §7.2). */
export function IncidentHeader({ id }: { id: string }) {
  const incident = useIncident(id);
  const { can } = useSession();
  const [changing, setChanging] = useState(false);

  if (incident.isPending) return <ListSkeleton label="Loading incident" />;
  if (incident.isError)
    return (
      <Banner tone="danger" title="Could not load this incident.">
        {errorMessage(incident.error)}
      </Banner>
    );
  const i = incident.data;
  const next = manualNextStatuses(i.status);

  return (
    <div className="grid gap-3">
      <Link
        href="/incidents/"
        className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
      >
        <Icon name="arrowLeft" size="sm" />
        All incidents
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={i.severity} />
            <IncidentStatusBadge status={i.status} />
            <span className="text-[13px] text-ink-muted">
              {i.serviceName ?? 'No service'}
              {i.environment ? `, ${i.environment}` : ''}
            </span>
          </div>
          <h1 className="mt-2 font-display text-[28px] font-[650] leading-[34px] tracking-[-0.015em]">
            {i.title}
          </h1>
          <p className="mt-1 max-w-[72ch] text-ink-muted">
            {formatCount(i.eventCount)} {i.eventCount === 1 ? 'event' : 'events'}. First seen{' '}
            {formatDateTime(i.firstSeenAt)}, last seen {formatAgo(i.lastSeenAt)}.
            {i.repositoryFullName && ` Code: ${i.repositoryFullName}.`}
          </p>
          {i.description && <p className="mt-2 max-w-[72ch]">{i.description}</p>}
        </div>
        {can('engineer') && next.length > 0 && (
          <Button variant="secondary" onClick={() => setChanging(true)}>
            Change status
          </Button>
        )}
      </div>
      {i.serviceName && !i.serviceId && (
        <Banner tone="info" title={`${i.serviceName} is not set up as a service yet.`}>
          The AI cannot read its code until it has a repository.{' '}
          <Link href="/services/" className="font-semibold text-brand hover:underline">
            Set it up on Services
          </Link>
        </Banner>
      )}
      {changing && (
        <ChangeStatusDialog incident={i} options={next} onClose={() => setChanging(false)} />
      )}
    </div>
  );
}

function ChangeStatusDialog({
  incident,
  options,
  onClose,
}: {
  incident: Incident;
  options: IncidentStatus[];
  onClose: () => void;
}) {
  const { workspace } = useSession();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const move = useMutation({
    mutationFn: (body: { to: IncidentStatus; reason?: string }) =>
      api<Incident>(`/workspaces/${workspace.id}/incidents/${incident.id}/transitions`, {
        method: 'POST',
        // The API rejects the change if someone else moved the incident since this page loaded.
        json: { ...body, expectedVersion: incident.version },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: incidentKeys.detail(workspace.id, incident.id) });
      void qc.invalidateQueries({ queryKey: incidentKeys.all(workspace.id) });
      onClose();
    },
    onError: (e) => {
      setError(errorMessage(e));
      void qc.invalidateQueries({ queryKey: incidentKeys.detail(workspace.id, incident.id) });
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Change status"
      description={`Now: ${STATUS_META[incident.status].label}. The history keeps every change.`}
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const f = new FormData(e.currentTarget);
          const reason = String(f.get('reason')).trim();
          move.mutate({ to: f.get('to') as IncidentStatus, ...(reason ? { reason } : {}) });
        }}
      >
        <Field id="status-to" label="Move to">
          <Select id="status-to" name="to" defaultValue={options[0]}>
            {options.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="status-reason" label="Why (optional)">
          <textarea
            id="status-reason"
            name="reason"
            maxLength={1000}
            rows={3}
            className="w-full rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
          />
        </Field>
        <FormError>{error}</FormError>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={move.isPending}>
            {move.isPending ? 'Saving…' : 'Change status'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
