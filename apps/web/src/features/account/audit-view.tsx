'use client';

import { ListSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useSession } from '@/features/auth/session';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAuditEvents } from './queries';

const sentence = (action: string) =>
  action.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function AuditView() {
  const { can } = useSession();
  const q = useAuditEvents(can('admin'));

  const header = (
    <PageHeader
      title="Audit log"
      description="Every sign-in, approval, connection and setting change, with who did it. Entries cannot be edited or deleted."
    />
  );
  if (!can('admin'))
    return (
      <>
        {header}
        <Banner tone="info" title="Only admins and owners can read the audit log." />
      </>
    );
  if (q.isPending)
    return (
      <>
        {header}
        <ListSkeleton label="Loading" />
      </>
    );
  if (q.isError)
    return (
      <>
        {header}
        <Banner tone="danger" title="Could not load the audit log.">
          {errorMessage(q.error)}
        </Banner>
      </>
    );
  const events = q.data.pages.flat();

  return (
    <>
      {header}
      <Table label="Audit log, newest first">
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Who</Th>
            <Th>What</Th>
            <Th>Outcome</Th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <Tr key={e.id}>
              <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(e.occurredAt)}</Td>
              <Td>
                {e.actorEmail ??
                  (e.actorType === 'user' ? 'Unknown' : e.actorType === 'agent' ? 'AI' : 'System')}
              </Td>
              <Td>
                <div>{sentence(e.action)}</div>
                <div className="text-[13px] text-ink-muted">
                  {e.resourceType}
                  {e.resourceId ? ` · ${e.resourceId.slice(0, 36)}` : ''}
                </div>
              </Td>
              <Td>
                <Badge
                  tone={e.outcome === 'success' ? 'ok' : e.outcome === 'denied' ? 'warn' : 'danger'}
                >
                  {e.outcome}
                </Badge>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {q.hasNextPage && (
        <div>
          <Button
            variant="secondary"
            onClick={() => void q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
          >
            {q.isFetchingNextPage ? 'Loading…' : 'Load older'}
          </Button>
        </div>
      )}
    </>
  );
}
