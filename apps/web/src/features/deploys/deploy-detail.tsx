'use client';

import type { Deployment } from '@ape/api-contracts';
import Link from 'next/link';
import { Banner } from '@/components/ui/banner';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { IncidentStatusBadge } from '@/features/incidents/components/incident-status-badge';
import { errorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDeployment } from './queries';

const LINK = 'text-brand underline underline-offset-[3px]';

export function changeHref(d: Pick<Deployment, 'serviceId' | 'commitSha'>): string | null {
  return d.serviceId ? `/changes/${d.commitSha}/?service=${d.serviceId}` : null;
}

export function DeployDetail({ id }: { id: string }) {
  const deploy = useDeployment(id);
  if (deploy.isPending) return <p className="text-ink-muted">Loading deploy…</p>;
  if (deploy.isError) {
    return (
      <Banner tone="danger" title="Could not load this deploy.">
        {errorMessage(deploy.error)}
      </Banner>
    );
  }
  const d = deploy.data;
  const sha = d.commitSha.slice(0, 7);
  const change = changeHref(d);
  return (
    <>
      <Link href="/deploys/" className="text-sm text-ink-muted hover:text-brand">
        ← All deploys
      </Link>
      <PageHeader
        title={`${d.serviceName} ${d.version ?? sha}`}
        description={`Deployed to ${d.environment} ${formatAgo(d.deployedAt)}, on ${formatDateTime(d.deployedAt)} UTC.`}
      />
      <Card as="section">
        <CardHeader eyebrow="Deploy" title="What shipped" />
        <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-muted">Service</dt>
          <dd className="m-0">
            {d.serviceName} ({d.environment})
            {!d.serviceId && <span className="text-ink-muted"> · not set up as a service</span>}
          </dd>
          <dt className="text-ink-muted">Version</dt>
          <dd className="m-0 font-mono">{d.version ?? 'Not sent'}</dd>
          <dt className="text-ink-muted">Commit</dt>
          <dd className="m-0 flex flex-wrap gap-3 font-mono">
            {sha}
            {change && (
              <Link href={change} className={`font-sans ${LINK}`}>
                See the change
              </Link>
            )}
            {d.repositoryFullName && (
              <a
                href={`https://github.com/${d.repositoryFullName}/commit/${d.commitSha}`}
                target="_blank"
                rel="noreferrer"
                className={`font-sans ${LINK}`}
              >
                Open on GitHub
              </a>
            )}
          </dd>
          <dt className="text-ink-muted">Reported by</dt>
          <dd className="m-0">{d.integrationName ?? 'Deleted webhook'}</dd>
        </dl>
      </Card>

      <Card as="section">
        <CardHeader
          eyebrow="After this deploy"
          title={`Incidents opened ${d.next ? 'before the next deploy' : 'since'}`}
        />
        {d.incidents.length === 0 ? (
          <p className="m-0 mt-3 text-sm text-ink-muted">
            No incident for {d.serviceName} ({d.environment}) started in this window.
          </p>
        ) : (
          <ul className="mt-3">
            {d.incidents.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0"
              >
                <IncidentStatusBadge status={i.status} />
                <Link
                  href={`/incidents/${i.id}/`}
                  className="min-w-0 flex-1 font-semibold hover:text-brand"
                >
                  {i.title}
                </Link>
                <span className="text-[13px] text-ink-muted">
                  {i.severity} · first seen {formatDateTime(i.firstSeenAt)} UTC
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <nav
        aria-label="Other deploys of this service"
        className="flex flex-wrap justify-between gap-3"
      >
        {d.previous ? (
          <Link href={`/deploys/${d.previous.id}/`} className={LINK}>
            ← Previous: {d.previous.version ?? d.previous.commitSha.slice(0, 7)} (
            {formatDateTime(d.previous.deployedAt)})
          </Link>
        ) : (
          <span className="text-sm text-ink-muted">First deploy we received for this service</span>
        )}
        {d.next ? (
          <Link href={`/deploys/${d.next.id}/`} className={LINK}>
            Next: {d.next.version ?? d.next.commitSha.slice(0, 7)} (
            {formatDateTime(d.next.deployedAt)}) →
          </Link>
        ) : (
          <span className="text-sm text-ink-muted">Latest deploy</span>
        )}
      </nav>
    </>
  );
}
