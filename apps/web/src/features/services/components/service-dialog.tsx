'use client';

import { createServiceSchema, type CreateServiceInput, type Service } from '@ape/api-contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { useGitHubOverview } from '@/features/setup';
import { api, errorMessage } from '@/lib/api';
import { useZodForm } from '@/lib/use-zod-form';
import { repoOptions } from '../repo-options';

export type ServiceDraft = Pick<Service, 'name' | 'environment' | 'repositoryFullName'>;

type ServiceDialogProps = {
  editing: ServiceDraft | Service;
  workspaceId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function ServiceDialog({ editing, workspaceId, onClose, onSaved }: ServiceDialogProps) {
  const service = 'id' in editing ? editing : null;
  const github = useGitHubOverview();
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(createServiceSchema, {
    defaultValues: {
      name: editing.name,
      environment: editing.environment,
      repositoryFullName: editing.repositoryFullName,
      defaultBranch: service?.defaultBranch ?? 'main',
    },
  });
  const errors = form.formState.errors;
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
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setError(null);
          save.mutate(values);
        })}
      >
        <Field id="service-name" label="Name" error={errors.name?.message}>
          <Input
            id="service-name"
            maxLength={100}
            placeholder="checkout-api"
            invalid={Boolean(errors.name)}
            {...form.register('name')}
          />
        </Field>
        <Field id="service-env" label="Environment" error={errors.environment?.message}>
          <Input
            id="service-env"
            maxLength={40}
            invalid={Boolean(errors.environment)}
            {...form.register('environment')}
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
            aria-describedby="service-repo-msg"
            {...form.register('repositoryFullName', { setValueAs: (v: string) => v || null })}
          >
            <option value="">No repository yet</option>
            {repos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="service-branch" label="Default branch" error={errors.defaultBranch?.message}>
          <Input
            id="service-branch"
            maxLength={100}
            invalid={Boolean(errors.defaultBranch)}
            {...form.register('defaultBranch')}
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
