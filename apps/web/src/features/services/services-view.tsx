'use client';

import type { CreateServiceInput, Service } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useSession } from '@/features/auth/session';
import { useGitHubOverview } from '@/features/setup/queries';
import { api, errorMessage } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { useDiscoveredServices, useServices } from './queries';
import { repoOptions, suggestRepo } from './repo-options';

type Draft = Pick<Service, 'name' | 'environment' | 'repositoryFullName'>;

type Editing = null | Draft | Service;
const BLANK: Draft = { name: '', environment: 'production', repositoryFullName: null };

export function ServicesView() {
  const { workspace, can } = useSession();
  const ws = workspace.id;
  const qc = useQueryClient();
  const isAdmin = can('admin');
  const services = useServices();
  const discovered = useDiscoveredServices();
  const github = useGitHubOverview();
  const connectedRepos = github.data?.installations.flatMap((i) => i.repositories) ?? [];
  const [editing, setEditing] = useState<Editing>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['ws', ws] });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/workspaces/${ws}/services/${id}`, { method: 'DELETE' }),
    onSuccess: () => (setActionError(null), refresh()),
    onError: (e) => setActionError(errorMessage(e)),
  });

  const unmapped = services.data?.filter((s) => !s.repositoryFullName) ?? [];
  const addButton = isAdmin ? <Button onClick={() => setEditing(BLANK)}>Add service</Button> : null;

  return (
    <>
      <PageHeader
        title="Services"
        description="Each service sending us data, and the repository its code lives in. The AI reads that repository when it investigates."
        actions={
          addButton ?? (
            <span className="text-[13px] text-ink-muted">Only admins can change services.</span>
          )
        }
      />
      {actionError && (
        <Banner tone="danger" title="That did not work.">
          {actionError}
        </Banner>
      )}
      {unmapped.length > 0 && (
        <Banner
          tone="info"
          title={`${unmapped.map((s) => s.name).join(', ')} ${unmapped.length === 1 ? 'has' : 'have'} no repository yet.`}
        >
          Incidents from it are still detected, but the AI cannot read its code or propose a fix.
        </Banner>
      )}

      {discovered.data && discovered.data.length > 0 && (
        <section className="grid gap-3">
          <div>
            <h2 className="m-0 font-display text-base font-semibold">
              Sending data, not set up yet
            </h2>
            <p className="m-0 text-[13px] text-ink-muted">
              These names arrived in your telemetry. Set each one up with its repository so the AI
              can read its code.
            </p>
          </div>
          <Table label="Services sending data that are not set up yet">
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Last data</Th>
                <Th>Suggested repository</Th>
                {isAdmin && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {discovered.data.map((d) => {
                const suggested = suggestRepo(d.name, connectedRepos);
                return (
                  <Tr key={`${d.name}|${d.environment}`}>
                    <Td>
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-[13px] text-ink-muted">{d.environment}</div>
                    </Td>
                    <Td className="text-[13px] text-ink-muted">{formatAgo(d.lastReceivedAt)}</Td>
                    <Td className="font-mono text-[13px]">
                      {suggested ?? <span className="font-sans text-ink-muted">No match</span>}
                    </Td>
                    {isAdmin && (
                      <Td className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setEditing({
                              name: d.name,
                              environment: d.environment,
                              repositoryFullName: suggested,
                            })
                          }
                        >
                          Set up
                        </Button>
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </section>
      )}

      {services.isPending ? (
        <p className="text-ink-muted">Loading services…</p>
      ) : services.isError ? (
        <Banner tone="danger" title="Could not load services.">
          {errorMessage(services.error)}
        </Banner>
      ) : services.data.length === 0 ? (
        <EmptyState icon="box" title="No services yet" action={addButton}>
          {isAdmin
            ? 'Add your first service and pick the repository its code lives in, so incidents from it can be investigated and fixed.'
            : 'An admin adds services and links each one to its repository.'}
        </EmptyState>
      ) : (
        <Table label="Services">
          <thead>
            <tr>
              <Th>Service</Th>
              <Th>Repository</Th>
              <Th>Default branch</Th>
              {isAdmin && <Th className="text-right">Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {services.data.map((s) => (
              <Tr key={s.id}>
                <Td>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-[13px] text-ink-muted">{s.environment}</div>
                </Td>
                <Td className="font-mono text-[13px]">
                  {s.repositoryFullName ?? (
                    <span className="font-sans text-ink-muted">Not set</span>
                  )}
                </Td>
                <Td className="font-mono text-[13px]">{s.defaultBranch}</Td>
                {isAdmin && (
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={remove.isPending}
                        onClick={() =>
                          window.confirm(
                            `Delete ${s.name} (${s.environment})? Its incidents stay, but lose their link to it.`,
                          ) && remove.mutate(s.id)
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {isAdmin && editing && (
        <ServiceDialog
          key={'id' in editing ? editing.id : `new:${editing.name}:${editing.environment}`}
          editing={editing}
          workspaceId={ws}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </>
  );
}

function ServiceDialog({
  editing,
  workspaceId,
  onClose,
  onSaved,
}: {
  editing: Draft | Service;
  workspaceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const service = 'id' in editing ? editing : null;
  const github = useGitHubOverview();
  const [error, setError] = useState<string | null>(null);
  const repos = repoOptions(
    github.data?.installations.flatMap((i) => i.repositories) ?? [],
    editing.repositoryFullName,
  );
  const save = useMutation({
    mutationFn: (body: CreateServiceInput) =>
      service
        ? api<Service>(`/workspaces/${workspaceId}/services/${service.id}`, {
            method: 'PATCH',
            json: body,
          })
        : api<Service>(`/workspaces/${workspaceId}/services`, { method: 'POST', json: body }),
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={service ? `Edit ${service.name}` : 'Add a service'}
      description="The AI reads this repository when it investigates an incident from the service."
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const f = new FormData(e.currentTarget);
          save.mutate({
            name: String(f.get('name')).trim(),
            environment: String(f.get('environment')).trim(),
            repositoryFullName: String(f.get('repository')) || null,
            defaultBranch: String(f.get('branch')).trim(),
          });
        }}
      >
        <Field id="service-name" label="Name">
          <Input
            id="service-name"
            name="name"
            required
            maxLength={100}
            defaultValue={editing.name}
            placeholder="checkout-api"
          />
        </Field>
        <Field id="service-env" label="Environment">
          <Input
            id="service-env"
            name="environment"
            required
            maxLength={40}
            defaultValue={editing.environment}
          />
        </Field>
        <Field
          id="service-repo"
          label="Repository"
          hint={
            github.isPending
              ? 'Loading connected repositories…'
              : github.isError
                ? `Could not load repositories: ${errorMessage(github.error)}`
                : repos.length === 0
                  ? 'No repositories connected yet. Connect GitHub under Integrations → Code.'
                  : 'Repositories shared with the GitHub App.'
          }
        >
          <Select
            id="service-repo"
            name="repository"
            aria-describedby="service-repo-msg"
            defaultValue={editing.repositoryFullName ?? ''}
          >
            <option value="">No repository yet</option>
            {repos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="service-branch" label="Default branch">
          <Input
            id="service-branch"
            name="branch"
            required
            maxLength={100}
            defaultValue={service?.defaultBranch ?? 'main'}
          />
        </Field>
        <FormError>{error}</FormError>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : service ? 'Save changes' : 'Add service'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
