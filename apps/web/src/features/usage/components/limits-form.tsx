'use client';

import { workspaceLimitsSchema, type UsageSummary, type WorkspaceLimits } from '@ape/api-contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FormError, Input } from '@/components/ui/form';
import { api, errorMessage } from '@/lib/api';
import { useZodForm } from '@/lib/use-zod-form';

type LimitsFormProps = {
  limits: WorkspaceLimits;
  canEdit: boolean;
  workspaceId: string;
  onSaved: (s: UsageSummary) => void;
};

const emptyIsNull = (v: unknown) =>
  typeof v === 'string' ? (v.trim() === '' ? null : Number(v)) : v;

export function LimitsForm({ limits, canEdit, workspaceId, onSaved }: LimitsFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const form = useZodForm(workspaceLimitsSchema, { defaultValues: limits });
  const { errors } = form.formState;
  const save = useMutation({
    mutationFn: (body: WorkspaceLimits) =>
      api<UsageSummary>(`/workspaces/${workspaceId}/usage/limits`, { method: 'PUT', json: body }),
    onSuccess: (next) => (setSaved(true), onSaved(next)),
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Card as="section" className="grid gap-4">
      <div>
        <h2 className="m-0 font-display text-xl font-semibold">Limits</h2>
        <p className="m-0 text-[13px] text-ink-muted">
          {canEdit
            ? 'Leave a field empty for no limit. A blocked investigation shows why on the incident timeline and in the audit log.'
            : 'Only the workspace owner can change limits.'}
        </p>
      </div>
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setError(null);
          setSaved(false);
          save.mutate(values);
        })}
      >
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field
            id="limit-budget"
            label="Monthly AI budget (USD)"
            error={
              errors.monthlyAiBudgetUsd &&
              'Enter a budget of 0 or more, or leave it empty for no budget.'
            }
          >
            <Input
              id="limit-budget"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="No budget"
              disabled={!canEdit}
              invalid={Boolean(errors.monthlyAiBudgetUsd)}
              {...form.register('monthlyAiBudgetUsd', { setValueAs: emptyIsNull })}
            />
          </Field>
          <Field
            id="limit-concurrent"
            label="Investigations running at once"
            error={
              errors.maxConcurrentInvestigations &&
              'Enter a whole number of 1 or more, or leave it empty for no limit.'
            }
          >
            <Input
              id="limit-concurrent"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="No limit"
              disabled={!canEdit}
              invalid={Boolean(errors.maxConcurrentInvestigations)}
              {...form.register('maxConcurrentInvestigations', { setValueAs: emptyIsNull })}
            />
          </Field>
        </div>
        {error && <FormError>{error}</FormError>}
        {saved && (
          <p role="status" className="m-0 text-sm text-ok">
            Limits saved.
          </p>
        )}
        {canEdit && (
          <div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save limits'}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
