'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  createIncidentSchema,
  INCIDENT_STATUSES,
  SEVERITIES,
  type CreateIncidentInput,
  type IncidentListQuery,
} from '@ape/api-contracts';
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
import { useCreateIncident, useIncidents, useServices, useWorkspace } from '@/lib/queries';
import { timeAgo } from '@/lib/format';
import { atLeast } from '@/lib/roles';

const label = (s: string) => s.replace(/_/g, ' ');

function NewIncidentForm({ workspaceId, onDone }: { workspaceId: string; onDone: () => void }) {
  const services = useServices(workspaceId);
  const create = useCreateIncident(workspaceId);
  const form = useForm<CreateIncidentInput>({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: { severity: 'medium' },
  });
  return (
    <form
      onSubmit={form.handleSubmit(async (v) => {
        await create.mutateAsync({ ...v, serviceId: v.serviceId || undefined });
        onDone();
      })}
      className="grid gap-4 p-4 sm:grid-cols-[2fr_1fr_1fr]"
    >
      <Field label="Title" error={form.formState.errors.title?.message}>
        <Input placeholder="Checkout is failing for some users" {...form.register('title')} />
      </Field>
      <Field label="Service">
        <Select {...form.register('serviceId')}>
          <option value="">Unknown</option>
          {services.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.environment})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Severity">
        <Select {...form.register('severity')}>
          {SEVERITIES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center gap-2 sm:col-span-3">
        <Button type="submit" disabled={create.isPending}>
          Create incident
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <ErrorBox error={create.error} />
      </div>
    </form>
  );
}

export default function IncidentsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ws = useWorkspace(workspaceId);
  const services = useServices(workspaceId);
  const [filters, setFilters] = useState<IncidentListQuery>({ status: 'open' });
  const [creating, setCreating] = useState(false);
  const incidents = useIncidents(workspaceId, filters);
  const environments = [...new Set(services.data?.map((s) => s.environment) ?? [])];
  const set = (patch: Partial<IncidentListQuery>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Incidents"
        description="Deduplicated incidents from your error sources. Updates every few seconds."
        actions={
          atLeast(ws.data?.role, 'engineer') &&
          !creating && <Button onClick={() => setCreating(true)}>New incident</Button>
        }
      />
      {creating && (
        <Card className="mb-6">
          <NewIncidentForm workspaceId={workspaceId} onDone={() => setCreating(false)} />
        </Card>
      )}
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="Status">
          <Select
            value={filters.status ?? ''}
            onChange={(e) =>
              set({ status: (e.target.value || undefined) as IncidentListQuery['status'] })
            }
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="">All</option>
            {INCIDENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Severity">
          <Select
            value={filters.severity ?? ''}
            onChange={(e) =>
              set({ severity: (e.target.value || undefined) as IncidentListQuery['severity'] })
            }
          >
            <option value="">Any</option>
            {SEVERITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Service">
          <Select
            value={filters.serviceId ?? ''}
            onChange={(e) => set({ serviceId: e.target.value || undefined })}
          >
            <option value="">Any</option>
            {services.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.environment})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Environment">
          <Select
            value={filters.environment ?? ''}
            onChange={(e) => set({ environment: e.target.value || undefined })}
          >
            <option value="">Any</option>
            {environments.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </Select>
        </Field>
      </Card>
      <Card>
        {incidents.isPending ? (
          <Loading />
        ) : incidents.error ? (
          <div className="p-4">
            <ErrorBox error={incidents.error} />
          </div>
        ) : incidents.data.length === 0 ? (
          <EmptyState
            title="No incidents match"
            hint="Connect an error source on the Integrations page, or create one manually."
          />
        ) : (
          <Table head={['Severity', 'Incident', 'Service', 'Status', 'Events', 'Last seen']}>
            {incidents.data.map((i) => (
              <tr key={i.id} className="hover:bg-muted/50">
                <Td>
                  <Badge tone={i.severity}>{i.severity}</Badge>
                </Td>
                <Td className="max-w-md">
                  <Link
                    href={`/w/${workspaceId}/incidents/${i.id}`}
                    className="font-medium hover:underline"
                  >
                    {i.title}
                  </Link>
                </Td>
                <Td className="text-xs">
                  {i.serviceName ?? <span className="text-subtle">—</span>}
                  {i.environment && <span className="text-subtle"> · {i.environment}</span>}
                  {i.serviceName && !i.serviceId && <div className="text-warn">not mapped</div>}
                </Td>
                <Td>
                  <Badge tone={i.status}>{label(i.status)}</Badge>
                </Td>
                <Td className="tabular-nums">{i.eventCount}</Td>
                <Td className="whitespace-nowrap text-subtle">{timeAgo(i.lastSeenAt)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
