'use client';

import { INCIDENT_STATUSES, SEVERITIES, type IncidentListQuery } from '@ape/api-contracts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { useSession } from '@/features/auth/session';
import { useServices } from '@/features/services/queries';
import { errorMessage } from '@/lib/api';
import { STATUS_META } from '../live';
import { useIncidents } from '../queries';
import { IncidentFilterSelect } from './incident-filter-select';
import { IncidentTable } from './incident-table';
import { NewIncidentDialog } from './new-incident-dialog';

type FilterKey = 'status' | 'severity' | 'serviceId' | 'environment';

/** The incident inbox: filter by status, severity, service and environment (FRD FR-13). */
export function IncidentsView() {
  const { can } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const services = useServices();

  // Filters live in the URL so a filtered inbox can be shared; open incidents by default.
  const status = params.get('status') ?? 'open';
  const filters = {
    // "all" is a UI choice meaning no status filter; the API has no such value.
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
        <IncidentFilterSelect
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
        <IncidentFilterSelect
          label="Severity"
          value={filters.severity ?? ''}
          onChange={(v) => setFilter('severity', v)}
          options={[['', 'Any'], ...SEVERITIES.map((s) => [s, s] as [string, string])]}
        />
        <IncidentFilterSelect
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
        <IncidentFilterSelect
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
