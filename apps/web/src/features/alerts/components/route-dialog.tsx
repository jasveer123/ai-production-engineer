'use client';

import {
  ALERT_CONDITION_OPS,
  SEVERITIES,
  type AlertCondition,
  type AlertRoute,
  type AlertRouteInput,
  type AlertSource,
  type Severity,
} from '@ape/api-contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { api, errorMessage } from '@/lib/api';
import { OP_LABELS, parseList } from '../setup';

const NO_VALUE = new Set<AlertCondition['op']>(['exists', 'not_exists']);

export function RouteDialog({
  route,
  sources,
  workspaceId,
  onClose,
  onSaved,
}: {
  route: AlertRoute | null;
  sources: AlertSource[];
  workspaceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [conditions, setConditions] = useState<AlertCondition[]>(route?.conditions ?? []);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: AlertRouteInput) =>
      route
        ? api<AlertRoute>(`/workspaces/${workspaceId}/alert-routes/${route.id}`, {
            method: 'PATCH',
            json: body,
          })
        : api<AlertRoute>(`/workspaces/${workspaceId}/alert-routes`, {
            method: 'POST',
            json: body,
          }),
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e)),
  });
  const setCondition = (i: number, patch: Partial<AlertCondition>) =>
    setConditions((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={route ? `Edit ${route.name}` : 'Add a route'}
      description="An alert takes the first enabled route whose sources and conditions all match."
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const f = new FormData(e.currentTarget);
          const severity = String(f.get('severity'));
          save.mutate({
            name: String(f.get('name')).trim(),
            enabled: f.get('enabled') === 'on',
            sourceIds: f.getAll('sources').map(String),
            conditions: conditions.map((c) =>
              NO_VALUE.has(c.op) ? { field: c.field, op: c.op } : { ...c, value: c.value ?? '' },
            ),
            groupBy: parseList(String(f.get('groupBy'))),
            createIncident: f.get('createIncident') === 'on',
            incidentSeverity: severity ? (severity as Severity) : null,
          });
        }}
      >
        <Field id="route-name" label="Name">
          <Input
            id="route-name"
            name="name"
            required
            maxLength={80}
            defaultValue={route?.name}
            placeholder="Critical production alerts"
          />
        </Field>

        <fieldset className="grid gap-1.5">
          <legend className="text-[13px] font-semibold">Sources</legend>
          <span className="text-[13px] text-ink-muted">None ticked means any source.</span>
          {sources.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="sources"
                value={s.id}
                defaultChecked={route?.sourceIds.includes(s.id)}
              />
              {s.name}
            </label>
          ))}
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="text-[13px] font-semibold">Conditions (all must match)</legend>
          {conditions.length === 0 && (
            <span className="text-[13px] text-ink-muted">No conditions: every alert matches.</span>
          )}
          {conditions.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 max-sm:grid-cols-1">
              <Input
                aria-label={`Condition ${i + 1} field`}
                required
                value={c.field}
                onChange={(e) => setCondition(i, { field: e.target.value })}
                placeholder="severity or label.service"
              />
              <Select
                aria-label={`Condition ${i + 1} operator`}
                value={c.op}
                onChange={(e) => setCondition(i, { op: e.target.value as AlertCondition['op'] })}
              >
                {ALERT_CONDITION_OPS.map((op) => (
                  <option key={op} value={op}>
                    {OP_LABELS[op]}
                  </option>
                ))}
              </Select>
              <Input
                aria-label={`Condition ${i + 1} value`}
                disabled={NO_VALUE.has(c.op)}
                value={NO_VALUE.has(c.op) ? '' : (c.value ?? '')}
                onChange={(e) => setCondition(i, { value: e.target.value })}
                maxLength={200}
              />
              <Button
                variant="ghost"
                aria-label={`Remove condition ${i + 1}`}
                onClick={() => setConditions((cs) => cs.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button
              size="sm"
              variant="secondary"
              disabled={conditions.length >= 20}
              onClick={() =>
                setConditions((cs) => [...cs, { field: 'severity', op: 'eq', value: '' }])
              }
            >
              Add condition
            </Button>
          </div>
          <span className="text-[13px] text-ink-muted">
            Fields: title, description, severity, status or label.&lt;name&gt;.
          </span>
        </fieldset>

        <Field
          id="route-group"
          label="Group by labels"
          hint="Comma-separated, e.g. service, env. Alerts with the same values join one open incident."
        >
          <Input
            id="route-group"
            name="groupBy"
            defaultValue={route?.groupBy.join(', ')}
            placeholder="service"
          />
        </Field>

        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="createIncident"
              defaultChecked={route?.createIncident ?? true}
            />
            Open an incident (otherwise only record the alert)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={route?.enabled ?? true} />
            Enabled
          </label>
        </div>

        <Field id="route-severity" label="Incident severity">
          <Select
            id="route-severity"
            name="severity"
            aria-describedby="route-severity-msg"
            defaultValue={route?.incidentSeverity ?? ''}
          >
            <option value="">Use the alert&apos;s severity</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <FormError>{error}</FormError>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : route ? 'Save changes' : 'Add route'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
