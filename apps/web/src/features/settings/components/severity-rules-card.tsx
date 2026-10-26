'use client';

import { SEVERITIES, severityRulesSchema, type SeverityRule } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { FormError, Input, Select } from '@/components/ui/form';
import { useSession } from '@/features/auth';
import { SeverityBadge } from '@/features/incidents';
import { api, errorMessage } from '@/lib/api';
import { useZodForm } from '@/lib/use-zod-form';
import { settingsKeys, useSeverityRules } from '../queries';
import { cleanRule, describeRule } from '../severity-rules';

const CONDITIONS = [
  { key: 'environment', label: 'Environment', placeholder: 'production', max: 40 },
  { key: 'serviceName', label: 'Service', placeholder: 'checkout-api', max: 100 },
  { key: 'errorType', label: 'Error type', placeholder: 'TypeError', max: 200 },
] as const;

export function SeverityRulesCard() {
  const { workspace, can } = useSession();
  const qc = useQueryClient();
  const isAdmin = can('admin');
  const rules = useSeverityRules();
  const [error, setError] = useState<string | null>(null);
  // The form mirrors the server's rules until the admin edits; `isDirty` replaces a draft copy.
  const form = useZodForm(severityRulesSchema, {
    values: { rules: rules.data ?? [] },
    defaultValues: { rules: [] },
  });
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'rules' });
  const shown = form.watch('rules');

  const save = useMutation({
    mutationFn: (next: SeverityRule[]) =>
      api<SeverityRule[]>(`/workspaces/${workspace.id}/settings/severity-rules`, {
        method: 'PUT',
        json: { rules: next.map(cleanRule) },
      }),
    onSuccess: (saved) => {
      qc.setQueryData(settingsKeys.severityRules(workspace.id), saved);
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Card as="section" className="grid gap-4">
      <CardHeader
        eyebrow="Severity"
        title="How serious a new incident is"
        aside={<span className="text-[13px] text-ink-muted">First match wins</span>}
      />
      {rules.isPending ? (
        <ListSkeleton label="Loading rules" />
      ) : rules.isError ? (
        <Banner tone="danger" title="Could not load severity rules.">
          {errorMessage(rules.error)}
        </Banner>
      ) : (
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit((v) => save.mutate(v.rules))}
        >
          {fields.length === 0 ? (
            <p className="m-0 text-sm text-ink-muted">
              No rules of your own yet, so only the built-in ones below apply.
            </p>
          ) : (
            <ol className="m-0 grid list-none gap-0 p-0">
              {fields.map((field, i) => (
                <li
                  key={field.id}
                  className="flex flex-wrap items-end gap-3 border-t border-line py-3 first:border-t-0"
                >
                  <span className="w-6 pb-2.5 text-[13px] font-semibold text-ink-muted">
                    {i + 1}.
                  </span>
                  {isAdmin ? (
                    <>
                      {CONDITIONS.map((c) => (
                        <label key={c.key} className="grid min-w-36 flex-1 gap-1">
                          <span className="text-xs font-semibold text-ink-muted">{c.label}</span>
                          <Input
                            maxLength={c.max}
                            placeholder={`Any (e.g. ${c.placeholder})`}
                            {...form.register(`rules.${i}.${c.key}`)}
                          />
                        </label>
                      ))}
                      <label className="grid w-32 gap-1">
                        <span className="text-xs font-semibold text-ink-muted">Severity</span>
                        <Select {...form.register(`rules.${i}.severity`)}>
                          {SEVERITIES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Move rule ${i + 1} up`}
                          disabled={i === 0}
                          onClick={() => move(i, i - 1)}
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Move rule ${i + 1} down`}
                          disabled={i === fields.length - 1}
                          onClick={() => move(i, i + 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove rule ${i + 1}`}
                          onClick={() => remove(i)}
                        >
                          Remove
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 pb-1">
                        When {describeRule(shown[i] ?? field)}
                      </span>
                      <SeverityBadge severity={(shown[i] ?? field).severity} />
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
          <p className="m-0 text-[13px] text-ink-muted">
            Empty fields match anything; values must match exactly. After your rules: production
            incidents are high, everything else is medium.
          </p>
          <FormError>{error ?? form.formState.errors.rules?.root?.message}</FormError>
          {isAdmin ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                disabled={fields.length >= 50}
                onClick={() => append({ severity: 'medium' })}
              >
                Add rule
              </Button>
              {form.formState.isDirty && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    form.reset();
                    setError(null);
                  }}
                >
                  Discard changes
                </Button>
              )}
              <Button type="submit" disabled={!form.formState.isDirty || save.isPending}>
                {save.isPending ? 'Saving…' : 'Save rules'}
              </Button>
            </div>
          ) : (
            <p className="m-0 text-[13px] text-ink-muted">Only admins can change severity rules.</p>
          )}
        </form>
      )}
    </Card>
  );
}
