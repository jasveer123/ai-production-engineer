'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, PageHeader } from '@/components/ui';
import { useIncidents, useMembers, useServices, useWorkspace } from '@/lib/queries';

function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-subtle">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
  return href ? (
    <Link href={href} className="hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function OverviewPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ws = useWorkspace(workspaceId);
  const services = useServices(workspaceId);
  const members = useMembers(workspaceId);
  const open = useIncidents(workspaceId, { status: 'open', limit: 100 });

  return (
    <div className="max-w-5xl">
      <PageHeader title={ws.data?.name ?? 'Overview'} description="Workspace overview" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Open incidents"
          value={open.data?.length ?? '…'}
          href={`/w/${workspaceId}/incidents`}
        />
        <Stat
          label="Services"
          value={services.data?.length ?? '…'}
          href={`/w/${workspaceId}/services`}
        />
        <Stat
          label="Members"
          value={members.data?.length ?? '…'}
          href={`/w/${workspaceId}/members`}
        />
        <Stat label="PRs merged" value="—" />
      </div>
      <Card className="mt-6 p-4 text-sm text-subtle">
        Getting started: map your services to repositories on the{' '}
        <Link href={`/w/${workspaceId}/services`} className="text-accent hover:underline">
          Services
        </Link>{' '}
        page, then connect an error source and GitHub on{' '}
        <Link href={`/w/${workspaceId}/integrations`} className="text-accent hover:underline">
          Integrations
        </Link>
        . New incidents are investigated automatically.
      </Card>
    </div>
  );
}
