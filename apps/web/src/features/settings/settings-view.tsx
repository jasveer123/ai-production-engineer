'use client';

import {
  SEVERITIES,
  type ApprovalPolicyInput,
  type Severity,
  type SeverityRule,
} from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { FormError, Input, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { useSession } from '@/features/auth/session';
import { SeverityBadge } from '@/features/incidents/components/incident-badges';
import { api, errorMessage } from '@/lib/api';
import { NotificationChannels } from './notification-channels';
import { useApprovalPolicy, useSeverityRules } from './queries';
import { cleanRule, describeRule, moveItem } from './severity-rules';

export function SettingsView() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Where we tell you about incidents, how serious a new incident is, and who can approve a fix."
      />
      <NotificationChannels />
      <SeverityRules />
      <ApprovalPolicy />
    </>
  );
}

const CONDITIONS = [
  { key: 'environment', label: 'Environment', placeholder: 'production' },
  { key: 'serviceName', label: 'Service', placeholder: 'checkout-api' },
  { key: 'errorType', label: 'Error type', placeholder: 'TypeError' },
] as const;

function SeverityRules() {
  const { workspace, can } = useSession();
  const qc = useQueryClient();
  const isAdmin = can('admin');
  const rules = useSeverityRules();
  // null while untouched, so the editor shows what the server has.
  const [draft, setDraft] = useState<SeverityRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = draft ?? rules.data ?? [];

  const save = useMutation({
    mutationFn: (next: SeverityRule[]) =>
      api<SeverityRule[]>(`/workspaces/${workspace.id}/settings/severity-rules`, {
        method: 'PUT',
        json: { rules: next.map(cleanRule) },
      }),
    onSuccess: (saved) => {
      qc.setQueryData(['ws', workspace.id, 'settings', 'severity-rules'], saved);
      setDraft(null);
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const edit = (i: number, patch: Partial<SeverityRule>) =>
    setDraft(shown.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Card as="section" className="grid gap-4">
      <CardHeader
        eyebrow="Severity"
        title="How serious a new incident is"
        aside={<span className="text-[13px] text-ink-muted">First match wins</span>}
      />
      {rules.isPending ? (
        <p className="m-0 text-ink-muted">Loading rules…</p>
      ) : rules.isError ? (
        <Banner tone="danger" title="Could not load severity rules.">
          {errorMessage(rules.error)}
        </Banner>
      ) : (
        <>
          {shown.length === 0 ? (
            <p className="m-0 text-sm text-ink-muted">
              No rules of your own yet, so only the built-in ones below apply.
            </p>
          ) : (
            <ol className="m-0 grid list-none gap-0 p-0">
              {shown.map((rule, i) => (
                <li
                  // Rules have no id; position is their identity in this ordered list.
                  key={i}
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
                            value={rule[c.key] ?? ''}
                            maxLength={
                              c.key === 'errorType' ? 200 : c.key === 'serviceName' ? 100 : 40
                            }
                            placeholder={`Any (e.g. ${c.placeholder})`}
                            onChange={(e) => edit(i, { [c.key]: e.target.value })}
                          />
                        </label>
                      ))}
                      <label className="grid w-32 gap-1">
                        <span className="text-xs font-semibold text-ink-muted">Severity</span>
                        <Select
                          value={rule.severity}
                          onChange={(e) => edit(i, { severity: e.target.value as Severity })}
                        >
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
                          onClick={() => setDraft(moveItem(shown, i, -1))}
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Move rule ${i + 1} down`}
                          disabled={i === shown.length - 1}
                          onClick={() => setDraft(moveItem(shown, i, 1))}
                        >
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove rule ${i + 1}`}
                          onClick={() => setDraft(shown.filter((_, j) => j !== i))}
                        >
                          Remove
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 pb-1">When {describeRule(rule)}</span>
                      <SeverityBadge severity={rule.severity} />
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
          <FormError>{error}</FormError>
          {isAdmin ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                disabled={shown.length >= 50}
                onClick={() => setDraft([...shown, { severity: 'medium' }])}
              >
                Add rule
              </Button>
              {draft && (
                <Button variant="ghost" onClick={() => (setDraft(null), setError(null))}>
                  Discard changes
                </Button>
              )}
              <Button disabled={!draft || save.isPending} onClick={() => save.mutate(shown)}>
                {save.isPending ? 'Saving…' : 'Save rules'}
              </Button>
            </div>
          ) : (
            <p className="m-0 text-[13px] text-ink-muted">Only admins can change severity rules.</p>
          )}
        </>
      )}
    </Card>
  );
}

const APPROVER_LABEL: Record<ApprovalPolicyInput['prMinRole'], string> = {
  engineer: 'Engineers, Admins and the Owner',
  admin: 'Admins and the Owner',
  owner: 'Only the Owner',
};

function ApprovalPolicy() {
  const { workspace, can } = useSession();
  const qc = useQueryClient();
  const isOwner = can('owner');
  const policy = useApprovalPolicy();
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: ApprovalPolicyInput) =>
      api<ApprovalPolicyInput>(`/workspaces/${workspace.id}/settings/approval-policy`, {
        method: 'PUT',
        json: body,
      }),
    onSuccess: (saved) => {
      qc.setQueryData(['ws', workspace.id, 'settings', 'approval-policy'], saved);
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Card as="section" className="grid content-start gap-4">
      <CardHeader eyebrow="Approvals" title="Who can approve opening a pull request" />
      {policy.isPending ? (
        <p className="m-0 text-ink-muted">Loading policy…</p>
      ) : policy.isError ? (
        <Banner tone="danger" title="Could not load the approval policy.">
          {errorMessage(policy.error)}
        </Banner>
      ) : isOwner ? (
        <label className="grid max-w-sm gap-1.5">
          <span className="text-[13px] font-semibold">Lowest role that can approve</span>
          <Select
            value={policy.data.prMinRole}
            disabled={save.isPending}
            onChange={(e) =>
              save.mutate({ prMinRole: e.target.value as ApprovalPolicyInput['prMinRole'] })
            }
          >
            {Object.entries(APPROVER_LABEL).map(([role, label]) => (
              <option key={role} value={role}>
                {label}
              </option>
            ))}
          </Select>
        </label>
      ) : (
        <p className="m-0 text-sm">
          <span className="font-semibold">{APPROVER_LABEL[policy.data.prMinRole]}</span>
          <span className="block text-[13px] text-ink-muted">Only the Owner can change this.</span>
        </p>
      )}
      <FormError>{error}</FormError>
      <p className="m-0 text-[13px] text-ink-muted">
        A fix is opened as a pull request only after someone with this role approves it.
      </p>
    </Card>
  );
}
