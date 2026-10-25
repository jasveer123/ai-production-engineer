'use client';

import type { Service } from '@ape/api-contracts';
import Link from 'next/link';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { useDeployments } from '@/features/deploys/queries';
import { useServices } from '@/features/services/queries';
import { errorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { markCommits, type CommitState } from './deploy-markers';
import { useCommits } from './queries';

export const STATE: Record<CommitState, { tone: BadgeTone; text: string } | null> = {
  live: { tone: 'ok', text: 'Live' },
  pending: { tone: 'warn', text: 'Not deployed yet' },
  shipped: { tone: 'neutral', text: 'Deployed' },
  unknown: null,
};

export function ChangesView() {
  const services = useServices();
  const mapped = services.data?.filter((s) => s.repositoryFullName) ?? [];
  const unmapped = services.data?.filter((s) => !s.repositoryFullName) ?? [];

  return (
    <>
      <PageHeader
        title="Changes"
        description="Recent commits on each service's default branch, marked with the deploys that shipped them."
      />
      {services.isPending ? (
        <ListSkeleton label="Loading services" />
      ) : services.isError ? (
        <Banner tone="danger" title="Could not load services.">
          {errorMessage(services.error)}
        </Banner>
      ) : mapped.length === 0 ? (
        <EmptyState
          icon="git"
          title="No service is linked to a repository yet"
          action={<ButtonLink href="/services/">Link a repository</ButtonLink>}
        >
          Changes come from each service&apos;s GitHub repository. Link one on the Services page.
        </EmptyState>
      ) : (
        <>
          {unmapped.length > 0 && (
            <Banner tone="info" title={`${unmapped.map((s) => s.name).join(', ')} not shown.`}>
              No repository is linked, so we cannot read its commits.
            </Banner>
          )}
          {mapped.map((s) => (
            <ServiceChanges key={s.id} service={s} />
          ))}
        </>
      )}
    </>
  );
}

function ServiceChanges({ service }: { service: Service }) {
  const commits = useCommits(service.id);
  const deploys = useDeployments({ service: service.name, environment: service.environment });
  const id = `changes-${service.id}`;

  return (
    <section aria-labelledby={id} className="grid gap-3">
      <div>
        <h2 id={id} className="m-0 font-display text-xl font-semibold">
          {service.name}{' '}
          <span className="text-base font-normal text-ink-muted">({service.environment})</span>
        </h2>
        <p className="m-0 font-mono text-[13px] text-ink-muted">
          {service.repositoryFullName} · {service.defaultBranch}
        </p>
      </div>
      {commits.isPending ? (
        <ListSkeleton label="Loading commits" />
      ) : commits.isError ? (
        <Banner tone="danger" title="Could not read this repository.">
          {errorMessage(commits.error)}
        </Banner>
      ) : commits.data.length === 0 ? (
        <Card className="text-ink-muted">No commits on {service.defaultBranch} yet.</Card>
      ) : (
        <>
          {deploys.isSuccess && deploys.data.length === 0 && (
            <p className="m-0 text-[13px] text-ink-muted">
              No deploys reported for this service yet, so commits carry no deploy markers.
            </p>
          )}
          <ul className="overflow-hidden rounded-lg border border-line bg-surface-raised shadow-raised">
            {markCommits(commits.data, deploys.data ?? []).map(({ commit, state, deploys: ds }) => {
              const badge = STATE[state];
              return (
                <li
                  key={commit.sha}
                  className="flex flex-wrap items-start justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/changes/${commit.sha}/?service=${service.id}`}
                      className="font-semibold hover:text-brand"
                    >
                      {commit.message || '(no message)'}
                    </Link>
                    <p className="m-0 text-[13px] text-ink-muted">
                      <span className="font-mono">{commit.sha.slice(0, 7)}</span>
                      {commit.author && <> · {commit.author}</>}
                      {commit.date && <> · {formatAgo(commit.date)}</>}
                    </p>
                    {ds.map((d) => (
                      <p key={d.id} className="m-0 text-[13px] text-ink-muted">
                        Deployed {d.version ? `as ${d.version} ` : ''}on{' '}
                        {formatDateTime(d.deployedAt)} UTC
                      </p>
                    ))}
                  </div>
                  {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
