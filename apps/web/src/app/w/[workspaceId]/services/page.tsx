'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createServiceSchema, type CreateServiceInput, type Service } from '@ape/api-contracts';
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Loading,
  PageHeader,
  Table,
  Td,
} from '@/components/ui';
import {
  useCreateService,
  useDeleteService,
  useServices,
  useUpdateService,
  useWorkspace,
} from '@/lib/queries';
import { atLeast } from '@/lib/roles';

function ServiceForm({
  workspaceId,
  initial,
  onDone,
}: {
  workspaceId: string;
  initial?: Service;
  onDone: () => void;
}) {
  const create = useCreateService(workspaceId);
  const update = useUpdateService(workspaceId);
  const mutation = initial ? update : create;
  const form = useForm<CreateServiceInput>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          environment: initial.environment,
          repositoryFullName: initial.repositoryFullName ?? '',
          defaultBranch: initial.defaultBranch,
        }
      : { environment: 'production', defaultBranch: 'main' },
  });
  const e = form.formState.errors;

  const submit = async (values: CreateServiceInput) => {
    const body = { ...values, repositoryFullName: values.repositoryFullName || null };
    if (initial) await update.mutateAsync({ id: initial.id, ...body });
    else await create.mutateAsync(body);
    onDone();
  };

  return (
    <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 p-4 sm:grid-cols-2">
      <Field label="Service name" error={e.name?.message}>
        <Input placeholder="checkout-api" {...form.register('name')} />
      </Field>
      <Field label="Environment" error={e.environment?.message}>
        <Input placeholder="production" {...form.register('environment')} />
      </Field>
      <Field label="GitHub repository" error={e.repositoryFullName?.message}>
        <Input
          placeholder="owner/repo"
          {...form.register('repositoryFullName', { setValueAs: (v: string) => v.trim() || null })}
        />
      </Field>
      <Field label="Default branch" error={e.defaultBranch?.message}>
        <Input {...form.register('defaultBranch')} />
      </Field>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {initial ? 'Save changes' : 'Add service'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <ErrorBox error={mutation.error} />
      </div>
    </form>
  );
}

export default function ServicesPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ws = useWorkspace(workspaceId);
  const services = useServices(workspaceId);
  const remove = useDeleteService(workspaceId);
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const canEdit = atLeast(ws.data?.role, 'admin');

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Services"
        description="Map each service and environment to the GitHub repository that holds its code."
        actions={
          canEdit &&
          editing === null && <Button onClick={() => setEditing('new')}>Add service</Button>
        }
      />
      {editing !== null && (
        <Card className="mb-6">
          <ServiceForm
            key={editing === 'new' ? 'new' : editing.id}
            workspaceId={workspaceId}
            initial={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        </Card>
      )}
      <Card>
        {services.isPending ? (
          <Loading />
        ) : services.error ? (
          <div className="p-4">
            <ErrorBox error={services.error} />
          </div>
        ) : services.data.length === 0 ? (
          <EmptyState
            title="No services yet"
            hint={canEdit ? 'Add a service to map it to a repository.' : undefined}
          />
        ) : (
          <Table head={['Service', 'Environment', 'Repository', 'Branch', '']}>
            {services.data.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium">{s.name}</Td>
                <Td>{s.environment}</Td>
                <Td className="font-mono text-xs">
                  {s.repositoryFullName ?? <span className="text-warn">Not mapped</span>}
                </Td>
                <Td className="font-mono text-xs">{s.defaultBranch}</Td>
                <Td className="text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" className="h-8" onClick={() => setEditing(s)}>
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="h-8"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(s.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <div className="mt-3">
        <ErrorBox error={remove.error} />
      </div>
      {!canEdit && ws.data && (
        <p className="mt-4 text-sm text-subtle">
          You have the {ws.data.role} role, so service mappings are read-only.
        </p>
      )}
    </div>
  );
}
