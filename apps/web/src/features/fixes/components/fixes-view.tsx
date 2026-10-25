'use client';

import type { PullRequestView } from '@ape/api-contracts';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useSession } from '@/features/auth/session';
import { errorMessage } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { PR_STATUSES, countByStatus, filterPulls, parsePrFilter } from '../fixes';
import { usePullRequests, useSyncPullRequest } from '../queries';

const STATUS_TONE = { open: 'brand', merged: 'ok', closed: 'neutral' } as const;
const CHECKS = {
  pending: { tone: 'warn', text: 'CI running' },
  passing: { tone: 'ok', text: 'CI passing' },
  failing: { tone: 'danger', text: 'CI failing' },
  none: { tone: 'neutral', text: 'No CI checks' },
} as const;

// GitHub check conclusions that do not block a merge.
const OK_CONCLUSIONS = ['success', 'neutral', 'skipped'];

/** Every fix pull request the platform opened, across incidents. */
export function FixesView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pulls = usePullRequests();
  const sync = useSyncPullRequest();
  const canSync = useSession().can('engineer');
  const filter = parsePrFilter(params.get('status'));
  const counts = countByStatus(pulls.data ?? []);

  const setFilter = (value: string) => {
    const sp = new URLSearchParams(params);
    if (value === 'all') sp.delete('status');
    else sp.set('status', value);
    router.replace(`${pathname}?${sp}`);
  };

  return (
    <>
      <PageHeader
        title="Fixes & PRs"
        description="Pull requests the AI opened for validated fixes. Each fix was proven by a test that failed before the patch and passed after it."
      />

      <label htmlFor="filter-pr-status" className="grid w-fit gap-1 text-[13px] font-semibold">
        Status
        <Select
          id="filter-pr-status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-9 w-auto min-w-[150px] font-normal capitalize"
        >
          {(['all', ...PR_STATUSES] as const).map((s) => (
            <option key={s} value={s}>
              {s} ({counts[s]})
            </option>
          ))}
        </Select>
      </label>

      {sync.isError && (
        <Banner tone="danger" title="Could not sync the pull request.">
          {errorMessage(sync.error)}
        </Banner>
      )}

      {pulls.isPending ? (
        <p className="text-ink-muted">Loading pull requests…</p>
      ) : pulls.isError ? (
        <Banner tone="danger" title="Could not load pull requests.">
          {errorMessage(pulls.error)}
        </Banner>
      ) : pulls.data.length === 0 ? (
        <EmptyState icon="code" title="No fix pull requests yet">
          When a fix passes validation and someone approves it, the AI opens a pull request on the
          service&apos;s GitHub repository. Connect GitHub in Integrations and link a repository to
          each service.
        </EmptyState>
      ) : filterPulls(pulls.data, filter).length === 0 ? (
        <EmptyState icon="code" title={`No ${filter} pull requests`}>
          Choose another status to see the rest.
        </EmptyState>
      ) : (
        <PullTable
          pulls={filterPulls(pulls.data, filter)}
          onSync={canSync ? (id) => sync.mutate(id) : undefined}
          syncingId={sync.isPending ? sync.variables : undefined}
        />
      )}
    </>
  );
}

function PullTable({
  pulls,
  onSync,
  syncingId,
}: {
  pulls: PullRequestView[];
  onSync?: (id: string) => void;
  syncingId?: string;
}) {
  return (
    <Table label="Fix pull requests, newest first">
      <thead>
        <tr>
          <Th>Pull request</Th>
          <Th>Incident</Th>
          <Th>Status</Th>
          <Th>CI checks</Th>
          <Th>Approved by</Th>
          <Th>Synced</Th>
          {onSync && <Th className="sr-only">Actions</Th>}
        </tr>
      </thead>
      <tbody>
        {pulls.map((pr) => {
          const failing = pr.checks.filter(
            (c) => c.conclusion && !OK_CONCLUSIONS.includes(c.conclusion),
          );
          return (
            <Tr key={pr.id}>
              <Td className="min-w-[220px]">
                {pr.url ? (
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold hover:text-brand"
                  >
                    {pr.title ?? pr.branchName}
                  </a>
                ) : (
                  <span className="font-semibold">{pr.title ?? pr.branchName}</span>
                )}
                <div className="text-[13px] text-ink-muted">
                  {pr.repositoryFullName ?? 'Repository unknown'}
                  {pr.number !== null ? ` #${pr.number}` : ', opening'}
                </div>
              </Td>
              <Td className="min-w-[200px]">
                {pr.incidentId ? (
                  <Link href={`/incidents/${pr.incidentId}/fix/`} className="hover:text-brand">
                    {pr.incidentTitle ?? 'View incident'}
                  </Link>
                ) : (
                  <span className="text-ink-muted">No incident</span>
                )}
              </Td>
              <Td>
                <Badge tone={STATUS_TONE[pr.status]}>
                  <span className="capitalize">{pr.status}</span>
                </Badge>
              </Td>
              <Td className="text-[13px]">
                <Badge tone={CHECKS[pr.checksStatus].tone}>{CHECKS[pr.checksStatus].text}</Badge>
                {failing.length > 0 && (
                  <div className="mt-1 text-ink-muted">
                    Failed: {failing.map((c) => c.name).join(', ')}
                  </div>
                )}
              </Td>
              <Td className="text-[13px]">
                {pr.approvedBy ?? <span className="text-ink-muted">Not yet</span>}
              </Td>
              <Td className="whitespace-nowrap text-[13px] text-ink-muted">
                {formatAgo(pr.lastSyncedAt)}
              </Td>
              {onSync && (
                <Td>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={syncingId === pr.id}
                    onClick={() => onSync(pr.id)}
                    aria-label={`Sync pull request ${pr.number ?? pr.branchName} from GitHub`}
                  >
                    {syncingId === pr.id ? 'Syncing…' : 'Sync'}
                  </Button>
                </Td>
              )}
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
