'use client';

import {
  INCIDENT_STATUSES,
  SEVERITIES,
  type CreateIncidentInput,
  type Incident,
  type IncidentListQuery,
} from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useSession } from '@/features/auth/session';
import { useServices } from '@/features/services/queries';
import { api, errorMessage } from '@/lib/api';
import { formatAgo, formatCount } from '@/lib/format';
import { STATUS_META } from '../live';
import { useIncidents } from '../queries';
import { IncidentStatusBadge } from './incident-status-badge';
import { SeverityBadge } from './incident-badges';

type FilterKey = 'status' | 'severity' | 'serviceId' | 'environment';

export function IncidentsView() {
  const { can } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const services = useServices();

  const status = params.get('status') ?? 'open';
  const filters = {
    status: (status === 'all' ? undefined : status) as IncidentListQuery['status'],
    severity: (params.get('severity') ?? undefined) as IncidentListQuery['severity'],
    serviceId: params.get('serviceId') ?? undefined,
    environment: params.get('environment') ?? undefined,
  };
  const incidents = useIncidents(filters);
  const setFilter = (key: FilterKey, value: string) => {
    const sp = new URLSearchParams(params);
    if (value) sp.set(key, value);
    else sp.delete(key);
    router.replace(`${pathname}?${sp}`);
  };
  const environments = [...new Set(services.data?.map((s) => s.environment) ?? [])].sort();

  return (
    <>
      <PageHeader
        title="Incidents"
        description="Repeated errors and alerts are grouped into one incident. The AI investigates each new one."
        actions={
          can('engineer') ? (
            <Button onClick={() => setCreating(true)}>New incident</Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-3" role="group" aria-label="Filter incidents">
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => setFilter('status', v)}
          options={[
            ['open', 'Open'],
            ['closed', 'Closed'],
            ['all', 'All'],
            ...INCIDENT_STATUSES.map((s) => [s, STATUS_META[s].label] as [string, string]),
          ]}
        />
        <FilterSelect
          label="Severity"
          value={filters.severity ?? ''}
          onChange={(v) => setFilter('severity', v)}
          options={[['', 'Any'], ...SEVERITIES.map((s) => [s, s] as [string, string])]}
        />
        <FilterSelect
          label="Service"
          value={filters.serviceId ?? ''}
          onChange={(v) => setFilter('serviceId', v)}
          options={[
            ['', 'Any'],
            ...(services.data ?? []).map(
              (s) => [s.id, `${s.name} (${s.environment})`] as [string, string],
            ),
          ]}
        />
        <FilterSelect
          label="Environment"
          value={filters.environment ?? ''}
          onChange={(v) => setFilter('environment', v)}
          options={[['', 'Any'], ...environments.map((e) => [e, e] as [string, string])]}
        />
      </div>

      {incidents.isPending ? (
        <p className="text-ink-muted">Loading incidents…</p>
      ) : incidents.isError ? (
        <Banner tone="danger" title="Could not load incidents.">
          {errorMessage(incidents.error)}
        </Banner>
      ) : incidents.data.length === 0 ? (
        <EmptyState icon="flame" title="No incidents match">
          Incidents appear here when your services send errors or alerts. Send data from
          Integrations, or create one by hand.
        </EmptyState>
      ) : (
        <IncidentTable incidents={incidents.data} />
      )}

      {creating && <NewIncidentDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <label htmlFor={id} className="grid gap-1 text-[13px] font-semibold">
      {label}
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-auto min-w-[150px] font-normal capitalize"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </Select>
    </label>
  );
}

function IncidentTable({ incidents }: { incidents: Incident[] }) {
  return (
    <Table label="Incidents, newest first">
      <thead>
        <tr>
          <Th>Severity</Th>
          <Th>Incident</Th>
          <Th>Status</Th>
          <Th className="text-right">Events</Th>
          <Th>Last seen</Th>
        </tr>
      </thead>
      <tbody>
        {incidents.map((incident) => (
          <Tr key={incident.id}>
            <Td>
              <SeverityBadge severity={incident.severity} />
            </Td>
            <Td className="min-w-[260px]">
              <Link href={`/incidents/${incident.id}/`} className="font-semibold hover:text-brand">
                {incident.title}
              </Link>
              <div className="text-[13px] text-ink-muted">
                {incident.serviceName ?? 'No service'}
                {incident.environment ? `, ${incident.environment}` : ''}
                {incident.serviceName && !incident.serviceId ? ' (not set up yet)' : ''}
              </div>
            </Td>
            <Td>
              <IncidentStatusBadge status={incident.status} />
            </Td>
            <Td className="text-right tabular-nums">{formatCount(incident.eventCount)}</Td>
            <Td className="whitespace-nowrap text-ink-muted">{formatAgo(incident.lastSeenAt)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

function NewIncidentDialog({ onClose }: { onClose: () => void }) {
  const { workspace } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const services = useServices();
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (body: CreateIncidentInput) =>
      api<Incident>(`/workspaces/${workspace.id}/incidents`, { method: 'POST', json: body }),
    onSuccess: (incident) => {
      void qc.invalidateQueries({ queryKey: ['ws', workspace.id, 'incidents'] });
      router.push(`/incidents/${incident.id}/`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="New incident"
      description="For a problem the platform has not detected on its own, like a customer report."
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const f = new FormData(e.currentTarget);
          const description = String(f.get('description')).trim();
          const serviceId = String(f.get('serviceId'));
          create.mutate({
            title: String(f.get('title')).trim(),
            severity: f.get('severity') as CreateIncidentInput['severity'],
            ...(description ? { description } : {}),
            ...(serviceId ? { serviceId } : {}),
          });
        }}
      >
        <Field id="incident-title" label="What is happening?">
          <Input
            id="incident-title"
            name="title"
            required
            minLength={3}
            maxLength={200}
            placeholder="Checkout fails for some customers"
          />
        </Field>
        <Field id="incident-severity" label="Severity">
          <Select
            id="incident-severity"
            name="severity"
            defaultValue="medium"
            className="capitalize"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="incident-service" label="Service">
          <Select id="incident-service" name="serviceId" defaultValue="">
            <option value="">Not sure yet</option>
            {(services.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.environment})
              </option>
            ))}
          </Select>
        </Field>
        <Field id="incident-description" label="Details (optional)">
          <textarea
            id="incident-description"
            name="description"
            maxLength={5000}
            rows={4}
            className="w-full rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
          />
        </Field>
        <FormError>{error}</FormError>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create incident'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
