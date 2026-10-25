'use client';

import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { errorMessage } from '@/lib/api';
import { useAlerts } from '../queries';
import { AlertsTable } from './alerts-table';

const FILTERS = [
  { value: undefined, label: 'All' },
  { value: 'firing', label: 'Firing' },
  { value: 'resolved', label: 'Resolved' },
] as const;

export function AlertsList() {
  const [status, setStatus] = useState<'firing' | 'resolved' | undefined>(undefined);
  const alerts = useAlerts(status);

  return (
    <section aria-label="Alerts" className="grid gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by state">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            size="sm"
            variant={status === f.value ? 'primary' : 'secondary'}
            aria-pressed={status === f.value}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      {alerts.isPending ? (
        <p className="text-ink-muted">Loading alerts…</p>
      ) : alerts.isError ? (
        <Banner tone="danger" title="Could not load alerts.">
          {errorMessage(alerts.error)}
        </Banner>
      ) : alerts.data.length === 0 ? (
        <EmptyState
          icon="bell"
          title={status ? `No ${status} alerts` : 'No alerts yet'}
          action={
            !status && (
              <ButtonLink href="/alerts/sources/" variant="secondary">
                Add an alert source
              </ButtonLink>
            )
          }
        >
          {status
            ? 'Nothing matches this filter right now.'
            : 'Connect a tool as an alert source. Its alerts show up here, and routes decide which ones open an incident.'}
        </EmptyState>
      ) : (
        <AlertsTable alerts={alerts.data} />
      )}
    </section>
  );
}
