'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useDeployments } from '@/features/deploys/queries';
import { useServices } from '@/features/services/queries';
import { errorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { STATE } from './changes-view';
import { markCommits, sameSha } from './deploy-markers';
import { useCommits } from './queries';

const LINK = 'text-brand underline underline-offset-[3px]';

/** One commit of a service: its details from GitHub and the deploys that shipped it. */
export function ChangeDetail({ sha }: { sha: string }) {
  const serviceId = useSearchParams().get('service') ?? '';
  const services = useServices();
  const service = services.data?.find((s) => s.id === serviceId);
  const commits = useCommits(serviceId);
  const deploys = useDeployments({
    service: service?.name,
    environment: service?.environment,
    limit: 200,
  });

  const back = (
    <Link href="/changes/" className="text-sm text-ink-muted hover:text-brand">
      ← All changes
    </Link>
  );
  if (services.isPending) return <ListSkeleton label="Loading" />;
  if (!service) {
    return (
      <>
        {back}
        <Banner tone="info" title="Open this change from the Changes page.">
          The link does not say which service the commit belongs to.
        </Banner>
      </>
    );
  }
  if (commits.isPending || deploys.isPending) return <ListSkeleton label="Loading" />;
  if (deploys.isError) {
    return (
      <>
        {back}
        <Banner tone="danger" title="Could not load this change.">
          {errorMessage(deploys.error)}
        </Banner>
      </>
    );
  }

  // Without GitHub access the deploy markers still show; only the commit details are missing.
  const marked = commits.isSuccess
    ? markCommits(commits.data, deploys.data).find((m) => sameSha(m.commit.sha, sha))
    : undefined;
  const github = `https://github.com/${service.repositoryFullName}/commit/${sha}`;
  // Deploys of this commit, even when it is older than the 20 commits we list.
  const shipped = deploys.data.filter((d) => sameSha(d.commitSha, sha));
  const badge = marked ? STATE[marked.state] : null;

  return (
    <>
      {back}
      <PageHeader
        eyebrow={`${service.name} (${service.environment}) · ${sha.slice(0, 7)}`}
        title={marked?.commit.message || `Commit ${sha.slice(0, 7)}`}
        actions={badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
      />
      <Card as="section">
        <CardHeader eyebrow="Commit" title="Details" />
        {commits.isError ? (
          <p className="m-0 mt-3 text-sm text-ink-muted">
            Commit details are not available: {errorMessage(commits.error)}.
          </p>
        ) : marked ? (
          <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-ink-muted">SHA</dt>
            <dd className="m-0 break-all font-mono">{marked.commit.sha}</dd>
            <dt className="text-ink-muted">Author</dt>
            <dd className="m-0">{marked.commit.author ?? 'Unknown'}</dd>
            <dt className="text-ink-muted">Committed</dt>
            <dd className="m-0">
              {marked.commit.date
                ? `${formatAgo(marked.commit.date)} (${formatDateTime(marked.commit.date)} UTC)`
                : 'Unknown'}
            </dd>
            <dt className="text-ink-muted">Repository</dt>
            <dd className="m-0 font-mono">
              {service.repositoryFullName} · {service.defaultBranch}
            </dd>
          </dl>
        ) : (
          <p className="m-0 mt-3 text-sm text-ink-muted">
            This commit is not among the latest 20 on {service.defaultBranch}, so its details are
            not loaded here.
          </p>
        )}
        {service.repositoryFullName && (
          <p className="m-0 mt-3 text-sm">
            <a
              href={marked?.commit.url ?? github}
              target="_blank"
              rel="noreferrer"
              className={LINK}
            >
              Open on GitHub
            </a>
          </p>
        )}
      </Card>
      <Card as="section">
        <CardHeader eyebrow="Deploys" title="Where this commit shipped" />
        {shipped.length === 0 ? (
          <p className="m-0 mt-3 text-sm text-ink-muted">
            {marked?.state === 'pending'
              ? 'Not deployed yet: a newer deploy marker has not included it.'
              : 'No deploy marker we received names this commit.'}
          </p>
        ) : (
          <ul className="mt-3">
            {shipped.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0"
              >
                <Link href={`/deploys/${d.id}/`} className="font-semibold hover:text-brand">
                  {d.version ?? d.commitSha.slice(0, 7)}
                </Link>
                <span className="text-[13px] text-ink-muted">
                  {d.environment} · {formatDateTime(d.deployedAt)} UTC
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
