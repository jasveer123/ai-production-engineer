'use client';

import { SEVERITIES, type Incident } from '@ape/api-contracts';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { DataTable } from '@/components/ui/data-table';
import { formatAgo, formatCount } from '@/lib/format';
import { SeverityBadge } from './incident-badges';
import { IncidentStatusBadge } from './incident-status-badge';

const COLUMNS: ColumnDef<Incident>[] = [
  {
    id: 'severity',
    header: 'Severity',

    accessorFn: (i) => SEVERITIES.indexOf(i.severity),
    cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
  },
  {
    id: 'incident',
    header: 'Incident',
    accessorFn: (i) => i.title,
    meta: { className: 'min-w-[260px]' },
    cell: ({ row: { original: incident } }) => (
      <>
        <Link href={`/incidents/${incident.id}/`} className="font-semibold hover:text-brand">
          {incident.title}
        </Link>
        <div className="text-[13px] text-ink-muted">
          {incident.serviceName ?? 'No service'}
          {incident.environment ? `, ${incident.environment}` : ''}
          {incident.serviceName && !incident.serviceId ? ' (not set up yet)' : ''}
        </div>
      </>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    accessorFn: (i) => i.status,
    cell: ({ row }) => <IncidentStatusBadge status={row.original.status} />,
  },
  {
    id: 'events',
    header: 'Events',
    accessorFn: (i) => i.eventCount,
    sortDescFirst: true,
    meta: { className: 'text-right tabular-nums' },
    cell: ({ row }) => formatCount(row.original.eventCount),
  },
  {
    id: 'lastSeen',
    header: 'Last seen',
    accessorFn: (i) => i.lastSeenAt,
    sortDescFirst: true,
    meta: { className: 'whitespace-nowrap text-ink-muted' },
    cell: ({ row }) => formatAgo(row.original.lastSeenAt),
  },
];

export function IncidentTable({ incidents }: { incidents: Incident[] }) {
  return (
    <DataTable
      label="Incidents, newest first"
      columns={COLUMNS}
      data={incidents}
      getRowId={(i) => i.id}
    />
  );
}
