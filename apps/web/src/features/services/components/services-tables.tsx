'use client';

import type { DiscoveredService, Service } from '@ape/api-contracts';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { formatAgo } from '@/lib/format';
import { suggestRepo } from '../repo-options';
import type { ServiceDraft } from './service-dialog';

const ACTIONS = { className: 'text-right' };

type ServicesTableProps = {
  services: Service[];
  isAdmin: boolean;
  deleting: boolean;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
};

export function ServicesTable({
  services,
  isAdmin,
  deleting,
  onEdit,
  onDelete,
}: ServicesTableProps) {
  const columns: ColumnDef<Service>[] = [
    {
      id: 'service',
      header: 'Service',
      accessorFn: (s) => `${s.name} ${s.environment}`,
      cell: ({ row: { original: s } }) => (
        <>
          <div className="font-semibold">{s.name}</div>
          <div className="text-[13px] text-ink-muted">{s.environment}</div>
        </>
      ),
    },
    {
      id: 'repository',
      header: 'Repository',
      accessorFn: (s) => s.repositoryFullName ?? '',
      meta: { className: 'font-mono text-[13px]' },
      cell: ({ row: { original: s } }) =>
        s.repositoryFullName ?? <span className="font-sans text-ink-muted">Not set</span>,
    },
    {
      id: 'branch',
      header: 'Default branch',
      accessorFn: (s) => s.defaultBranch,
      enableSorting: false,
      meta: { className: 'font-mono text-[13px]' },
    },
    ...(isAdmin
      ? [
          {
            id: 'actions',
            header: 'Actions',
            enableSorting: false,
            meta: ACTIONS,
            cell: ({ row: { original: s } }) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => onEdit(s)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" disabled={deleting} onClick={() => onDelete(s)}>
                  Delete
                </Button>
              </div>
            ),
          } satisfies ColumnDef<Service>,
        ]
      : []),
  ];
  return <DataTable label="Services" columns={columns} data={services} getRowId={(s) => s.id} />;
}

type DiscoveredTableProps = {
  discovered: DiscoveredService[];
  connectedRepos: string[];
  isAdmin: boolean;
  onSetUp: (draft: ServiceDraft) => void;
};

export function DiscoveredServicesTable({
  discovered,
  connectedRepos,
  isAdmin,
  onSetUp,
}: DiscoveredTableProps) {
  const columns: ColumnDef<DiscoveredService>[] = [
    {
      id: 'service',
      header: 'Service',
      accessorFn: (d) => `${d.name} ${d.environment}`,
      cell: ({ row: { original: d } }) => (
        <>
          <div className="font-semibold">{d.name}</div>
          <div className="text-[13px] text-ink-muted">{d.environment}</div>
        </>
      ),
    },
    {
      id: 'last',
      header: 'Last data',
      accessorFn: (d) => d.lastReceivedAt,
      sortDescFirst: true,
      meta: { className: 'text-[13px] text-ink-muted' },
      cell: ({ row: { original: d } }) => formatAgo(d.lastReceivedAt),
    },
    {
      id: 'suggested',
      header: 'Suggested repository',
      enableSorting: false,
      meta: { className: 'font-mono text-[13px]' },
      cell: ({ row: { original: d } }) =>
        suggestRepo(d.name, connectedRepos) ?? (
          <span className="font-sans text-ink-muted">No match</span>
        ),
    },
    ...(isAdmin
      ? [
          {
            id: 'actions',
            header: 'Actions',
            enableSorting: false,
            meta: ACTIONS,
            cell: ({ row: { original: d } }) => (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  onSetUp({
                    name: d.name,
                    environment: d.environment,
                    repositoryFullName: suggestRepo(d.name, connectedRepos),
                  })
                }
              >
                Set up
              </Button>
            ),
          } satisfies ColumnDef<DiscoveredService>,
        ]
      : []),
  ];
  return (
    <DataTable
      label="Services sending data that are not set up yet"
      columns={columns}
      data={discovered}
      getRowId={(d) => `${d.name}|${d.environment}`}
    />
  );
}
