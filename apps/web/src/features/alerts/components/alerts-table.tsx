'use client';

import { SEVERITIES, type AlertView } from '@ape/api-contracts';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { SeverityBadge } from '@/features/incidents/components/incident-badges';
import { formatAgo, formatDateTime } from '@/lib/format';

const COLUMNS: ColumnDef<AlertView>[] = [
  {
    id: 'severity',
    header: 'Severity',
    accessorFn: (a) => SEVERITIES.indexOf(a.severity),
    cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
  },
  {
    id: 'alert',
    header: 'Alert',
    accessorFn: (a) => a.title,
    meta: { className: 'min-w-[240px]' },
    cell: ({ row: { original: a } }) => (
      <>
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
      </>
    ),
  },
  {
    id: 'state',
    header: 'State',
    accessorFn: (a) => a.status,
    cell: ({ row }) =>
      row.original.status === 'firing' ? (
        <Badge tone="danger">Firing</Badge>
      ) : (
        <Badge tone="ok">Resolved</Badge>
      ),
  },
  {
    id: 'route',
    header: 'Route',
    enableSorting: false,
    meta: { className: 'text-[13px] text-ink-muted' },
    cell: ({ row }) => row.original.routeName ?? 'No route matched',
  },
  {
    id: 'lastFired',
    header: 'Last fired',
    accessorFn: (a) => a.lastFiredAt,
    sortDescFirst: true,
    meta: { className: 'whitespace-nowrap text-ink-muted' },
    cell: ({ row: { original: a } }) => (
      <span title={formatDateTime(a.lastFiredAt)}>{formatAgo(a.lastFiredAt)}</span>
    ),
  },
];

export function AlertsTable({ alerts }: { alerts: AlertView[] }) {
  return <DataTable label="Alerts" columns={COLUMNS} data={alerts} getRowId={(a) => a.id} />;
}
