'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { SeverityBadge } from '@/features/incidents/components/incident-badges';
import { errorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useAlerts } from '../queries';

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
        <Table label="Alerts">
          <thead>
            <tr>
              <Th>Severity</Th>
              <Th>Alert</Th>
              <Th>State</Th>
              <Th>Route</Th>
              <Th>Last fired</Th>
            </tr>
          </thead>
          <tbody>
            {alerts.data.map((a) => (
              <Tr key={a.id}>
                <Td>
                  <SeverityBadge severity={a.severity} />
                </Td>
                <Td className="min-w-[240px]">
                  <div className="font-semibold">
                    {a.sourceUrl ? (
                      <a
                        href={a.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-2 hover:underline"
                      >
                        {a.title}
                      </a>
                    ) : (
                      a.title
                    )}
                  </div>
                  <div className="text-[13px] text-ink-muted">
                    from {a.sourceName}
                    {a.occurrences > 1 && ` · ${a.occurrences} times`}
                    {a.incidentId && (
                      <>
                        {' · '}
                        <Link
                          href={`/incidents/${a.incidentId}/`}
                          className="text-brand underline underline-offset-2"
                        >
                          {a.incidentTitle ?? 'open incident'}
                        </Link>
                      </>
                    )}
                  </div>
                </Td>
                <Td>
                  {a.status === 'firing' ? (
                    <Badge tone="danger">Firing</Badge>
                  ) : (
                    <Badge tone="ok">Resolved</Badge>
                  )}
                </Td>
                <Td className="text-[13px] text-ink-muted">{a.routeName ?? 'No route matched'}</Td>
                <Td
                  className="whitespace-nowrap text-ink-muted"
                  title={formatDateTime(a.lastFiredAt)}
                >
                  {formatAgo(a.lastFiredAt)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
