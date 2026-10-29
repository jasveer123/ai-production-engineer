'use client';

import {
  createIncidentSchema,
  SEVERITIES,
  type CreateIncidentInput,
  type Incident,
} from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { useSession } from '@/features/auth';
import { useServices } from '@/features/services';
import { api, errorMessage } from '@/lib/api';
import { useZodForm } from '@/lib/use-zod-form';
import { incidentKeys } from '../queries';

export function NewIncidentDialog({ onClose }: { onClose: () => void }) {
  const { workspace } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const services = useServices();
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(createIncidentSchema, {
    defaultValues: { title: '', severity: 'medium', serviceId: undefined, description: '' },
  });
  const { errors } = form.formState;
  const create = useMutation({
    mutationFn: (body: CreateIncidentInput) =>
      api<Incident>(`/workspaces/${workspace.id}/incidents`, { method: 'POST', json: body }),
    onSuccess: (incident) => {
      void qc.invalidateQueries({ queryKey: incidentKeys.all(workspace.id) });
      router.push(`/incidents/${incident.id}/`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="New incident"
      description="For a problem the platform has not detected on its own, like a customer report."
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit(({ description, ...rest }) => {
          setError(null);
          create.mutate({ ...rest, ...(description ? { description } : {}) });
        })}
      >
        <Field id="incident-title" label="What is happening?" error={errors.title?.message}>
          <Input
            id="incident-title"
            maxLength={200}
            placeholder="Checkout fails for some customers"
            invalid={Boolean(errors.title)}
            {...form.register('title')}
          />
        </Field>
        <Field id="incident-severity" label="Severity">
          <Select id="incident-severity" className="capitalize" {...form.register('severity')}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="incident-service" label="Service">
          <Select
            id="incident-service"
            {...form.register('serviceId', { setValueAs: (v: string) => v || undefined })}
          >
            <option value="">Not sure yet</option>
            {(services.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.environment})
              </option>
            ))}
          </Select>
        </Field>
        <Field id="incident-description" label="Details (optional)">
          <textarea
            id="incident-description"
            maxLength={5000}
            rows={4}
            className="w-full rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
            {...form.register('description')}
          />
        </Field>
        <FormError>{error}</FormError>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create incident'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
