'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, Card, EmptyState, ErrorBox, Loading, PageHeader, Table, Td } from '@/components/ui';
import { PR_TONE } from '@/components/fix-panel';
import { usePullRequests } from '@/lib/queries';
import { timeAgo } from '@/lib/format';

export default function FixesPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const prs = usePullRequests(workspaceId);
  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Fixes & PRs"
        description="Pull requests opened from approved, validated fixes. Status and checks sync from GitHub."
      />
      <ErrorBox error={prs.error} />
      {prs.isPending ? (
        <Loading />
      ) : !prs.data?.length ? (
        <Card>
          <EmptyState
            title="No pull requests yet"
            hint="Approve a validated fix on an incident to open one."
          />
        </Card>
      ) : (
        <Card>
          <Table head={['Pull request', 'Incident', 'Status', 'Checks', 'Approved by', 'Opened']}>
            {prs.data.map((pr) => (
              <tr key={pr.id}>
                <Td>
                  {pr.url ? (
                    <a
                      className="text-accent hover:underline"
                      href={pr.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {pr.repositoryFullName}#{pr.number}
                    </a>
                  ) : (
                    <span className="font-mono text-xs">{pr.branchName}</span>
                  )}
                  <p className="max-w-xs truncate text-xs text-subtle">{pr.title}</p>
                </Td>
                <Td>
                  {pr.incidentId ? (
                    <Link
                      className="hover:underline"
                      href={`/w/${workspaceId}/incidents/${pr.incidentId}`}
                    >
                      {pr.incidentTitle ?? 'Incident'}
                    </Link>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>
                  <Badge tone={PR_TONE[pr.status]}>{pr.status}</Badge>
                </Td>
                <Td>
                  <Badge tone={PR_TONE[pr.checksStatus]}>{pr.checksStatus}</Badge>
                </Td>
                <Td className="text-xs text-subtle">{pr.approvedBy ?? '—'}</Td>
                <Td className="text-xs text-subtle">{timeAgo(pr.createdAt)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
