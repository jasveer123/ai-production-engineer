'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { AuditQuery } from '@ape/api-contracts';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Loading,
  PageHeader,
  Select,
  Table,
  Td,
} from '@/components/ui';
import { useAuditEvents, useWorkspace } from '@/lib/queries';
import { atLeast } from '@/lib/roles';

const PAGE = 50;

export default function AuditPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ws = useWorkspace(workspaceId);
  const allowed = atLeast(ws.data?.role, 'admin');
  const [filters, setFilters] = useState<AuditQuery>({ limit: PAGE });
  const [draft, setDraft] = useState({ action: '', resourceType: '', outcome: '' });
  const events = useAuditEvents(workspaceId, filters, allowed);

  if (ws.data && !allowed) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Audit log" />
        <Card className="p-6 text-sm text-subtle">
          Only admins and owners can view the audit log.
        </Card>
      </div>
    );
  }

  const apply = () =>
    setFilters({
      limit: PAGE,
      action: draft.action || undefined,
      resourceType: draft.resourceType || undefined,
      outcome: (draft.outcome || undefined) as AuditQuery['outcome'],
    });
  const last = events.data?.at(-1);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Audit log"
        description="Append-only record of security-sensitive actions in this workspace."
      />
      <Card className="mb-4 p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <Field label="Action">
            <Input
              placeholder="member.role_changed"
              value={draft.action}
              onChange={(e) => setDraft({ ...draft, action: e.target.value })}
            />
          </Field>
          <Field label="Resource type">
            <Input
              placeholder="service"
              value={draft.resourceType}
              onChange={(e) => setDraft({ ...draft, resourceType: e.target.value })}
            />
          </Field>
          <Field label="Outcome">
            <Select
              value={draft.outcome}
              onChange={(e) => setDraft({ ...draft, outcome: e.target.value })}
            >
              <option value="">Any</option>
              <option value="success">success</option>
              <option value="denied">denied</option>
              <option value="failure">failure</option>
            </Select>
          </Field>
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
      </Card>
      <Card>
        {events.isPending ? (
          <Loading />
        ) : events.error ? (
          <div className="p-4">
            <ErrorBox error={events.error} />
          </div>
        ) : events.data.length === 0 ? (
          <EmptyState title="No matching events" />
        ) : (
          <Table head={['When', 'Actor', 'Action', 'Resource', 'Outcome', 'Correlation']}>
            {events.data.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap text-subtle">
                  {new Date(e.occurredAt).toLocaleString()}
                </Td>
                <Td>{e.actorEmail ?? <span className="text-subtle">{e.actorType}</span>}</Td>
                <Td className="font-mono text-xs">{e.action}</Td>
                <Td className="text-xs">
                  {e.resourceType}
                  {e.resourceId && (
                    <span className="ml-1 font-mono text-subtle">{e.resourceId.slice(0, 8)}</span>
                  )}
                </Td>
                <Td>
                  <Badge tone={e.outcome}>{e.outcome}</Badge>
                </Td>
                <Td className="font-mono text-xs text-subtle">{e.correlationId.slice(0, 8)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {last && events.data?.length === PAGE && (
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setFilters({ ...filters, before: last.occurredAt })}
          >
            Older events
          </Button>
          {filters.before && (
            <Button variant="ghost" onClick={() => setFilters({ ...filters, before: undefined })}>
              Back to newest
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
