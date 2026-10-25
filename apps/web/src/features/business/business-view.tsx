'use client';

import type { ServiceImpact, ServiceValueInput } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, Eyebrow } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { formatMoney, impactFormula, totalsByCurrency } from './money';
import { businessKeys, useBusinessImpact } from './queries';

const WINDOWS = [1, 7, 30, 90] as const;

export function BusinessView() {
  const { workspace, can } = useSession();
  const isAdmin = can('admin');
  const [days, setDays] = useState(7);
  const [editing, setEditing] = useState<ServiceImpact | null>(null);
  const impact = useBusinessImpact(days);
  const rows = impact.data?.services ?? [];
  const valued = rows.filter((s) => s.valuePerRequest !== null);
  const totals = totalsByCurrency(rows);

  return (
    <>
      <PageHeader
        title="Business impact"
        description="What failed requests cost, from your own telemetry and the value you set for one successful request. We never estimate a value for you."
        actions={
          <Field id="impact-window" label="Window">
            <Select
              id="impact-window"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {WINDOWS.map((d) => (
                <option key={d} value={d}>
                  Last {d === 1 ? '24 hours' : `${d} days`}
                </option>
              ))}
            </Select>
          </Field>
        }
      />

      {impact.isPending ? (
        <ListSkeleton label="Loading business impact" />
      ) : impact.isError ? (
        <Banner tone="danger" title="Could not load business impact.">
          {errorMessage(impact.error)}
        </Banner>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="chart"
          title="No services yet"
          action={<ButtonLink href="/services/">Add a service</ButtonLink>}
        >
          Business impact is worked out per service. Add one first.
        </EmptyState>
      ) : (
        <>
          {valued.length === 0 ? (
            <Banner tone="info" title="No money figures yet.">
              {isAdmin
                ? 'Set what one successful request is worth for a service (for example, average order value for checkout) and its failed requests turn into a cost.'
                : 'An admin sets what one successful request is worth for each service. Until then only failed request counts show.'}
            </Banner>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              {totals.map((t) => (
                <Card key={t.currency}>
                  <Eyebrow>Cost of failed requests ({t.currency})</Eyebrow>
                  <p className="m-0 mt-1 font-display text-2xl font-semibold tabular-nums">
                    {formatMoney(t.total, t.currency)}
                  </p>
                  <p className="m-0 text-[13px] text-ink-muted">
                    Services with a value set, {days === 1 ? 'last 24 hours' : `last ${days} days`}
                  </p>
                </Card>
              ))}
            </div>
          )}

          <Table label="Business impact per service">
            <thead>
              <tr>
                <Th>Service</Th>
                <Th className="text-right">Failed requests</Th>
                <Th className="text-right">Value per request</Th>
                <Th className="text-right">Impact</Th>
                {isAdmin && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const formula = impactFormula(s);
                return (
                  <Tr key={s.serviceId}>
                    <Td>
                      <div className="font-semibold">{s.serviceName}</div>
                      <div className="text-[13px] text-ink-muted">
                        {s.environment} · {s.incidents} incident{s.incidents === 1 ? '' : 's'}
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums">
                      <div className="font-semibold">{formatCount(s.failedRequests)}</div>
                      <div className="text-[12px] text-ink-muted">
                        {formatCount(s.errorSpanTraces)} error traces ·{' '}
                        {formatCount(s.incidentErrorEvents)} incident errors
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {s.valuePerRequest !== null && s.currency ? (
                        formatMoney(s.valuePerRequest, s.currency)
                      ) : (
                        <span className="text-ink-muted">Not set</span>
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formula && s.impact !== null && s.currency ? (
                        <>
                          <div className="font-semibold">{formatMoney(s.impact, s.currency)}</div>
                          <div className="text-[12px] text-ink-muted">{formula}</div>
                        </>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </Td>
                    {isAdmin && (
                      <Td className="text-right">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>
                          {s.valuePerRequest === null ? 'Set value' : 'Edit value'}
                        </Button>
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </tbody>
          </Table>

          <Card as="section" className="grid gap-2 text-[13px] text-ink-muted">
            <h2 className="m-0 font-display text-base font-semibold text-ink">
              How this is calculated
            </h2>
            <p className="m-0">
              Impact = failed requests × value per request. A failed request is one trace with an
              error span from the service, or one error event on its incidents. A trace seen by both
              counts once.
            </p>
            <p className="m-0">
              Lost requests that never reached your service (a total outage) leave no trace, so the
              real figure can be higher.
            </p>
          </Card>
        </>
      )}

      {isAdmin && editing && (
        <ValueDialog
          key={editing.serviceId}
          service={editing}
          workspaceId={workspace.id}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function ValueDialog({
  service,
  workspaceId,
  onClose,
}: {
  service: ServiceImpact;
  workspaceId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: ServiceValueInput) =>
      api(`/workspaces/${workspaceId}/business/services/${service.serviceId}/value`, {
        method: 'PUT',
        json: body,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: businessKeys.all(workspaceId) });
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Value of one ${service.serviceName} request`}
      description="What one successful request is worth to the business, for example average order value for a checkout service. Leave empty to show no money figures."
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const f = new FormData(e.currentTarget);
          const raw = String(f.get('value')).trim();
          save.mutate({
            valuePerRequest: raw === '' ? null : Number(raw),
            currency: String(f.get('currency')).trim() || 'USD',
          });
        }}
      >
        <Field id="value-amount" label="Value per successful request">
          <Input
            id="value-amount"
            name="value"
            type="number"
            min="0.0001"
            step="any"
            inputMode="decimal"
            defaultValue={service.valuePerRequest ?? ''}
          />
        </Field>
        <Field id="value-currency" label="Currency" hint="3-letter code, like USD or INR.">
          <Input
            id="value-currency"
            name="currency"
            required
            maxLength={3}
            pattern="[A-Za-z]{3}"
            defaultValue={service.currency ?? 'USD'}
          />
        </Field>
        {error && <FormError>{error}</FormError>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
