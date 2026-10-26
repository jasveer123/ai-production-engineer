'use client';

import type { Service } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { useSession } from '@/features/auth/session';
import { useGitHubOverview } from '@/features/setup/queries';
import { api, errorMessage } from '@/lib/api';
import { useDiscoveredServices, useServices } from './queries';
import { ServiceDialog, type ServiceDraft } from './components/service-dialog';
import { DiscoveredServicesTable, ServicesTable } from './components/services-tables';

// `null` closed, a Draft adding (empty for a blank form), a Service editing it.
type Editing = null | ServiceDraft | Service;
const BLANK: ServiceDraft = { name: '', environment: 'production', repositoryFullName: null };

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
  // Whole workspace: the GitHub card's "not shared yet" notice reads services too.
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
          <DiscoveredServicesTable
            discovered={discovered.data}
            connectedRepos={connectedRepos}
            isAdmin={isAdmin}
            onSetUp={setEditing}
          />
        </section>
      )}

      {services.isPending ? (
        <ListSkeleton label="Loading services" />
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
        <ServicesTable
          services={services.data}
          isAdmin={isAdmin}
          deleting={remove.isPending}
          onEdit={setEditing}
          onDelete={(s) =>
            window.confirm(
              `Delete ${s.name} (${s.environment})? Its incidents stay, but lose their link to it.`,
            ) && remove.mutate(s.id)
          }
        />
      )}

      {isAdmin && editing && (
        <ServiceDialog
          // Remount per target so the uncontrolled fields start from that service.
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
