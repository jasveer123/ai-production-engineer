'use client';

import type { ApprovalPolicyInput } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Banner } from '@/components/ui/banner';
import { Card, CardHeader } from '@/components/ui/card';
import { FormError, Select } from '@/components/ui/form';
import { useSession } from '@/features/auth';
import { api, errorMessage } from '@/lib/api';
import { settingsKeys, useApprovalPolicy } from '../queries';

const APPROVER_LABEL: Record<ApprovalPolicyInput['prMinRole'], string> = {
  engineer: 'Engineers, Admins and the Owner',
  admin: 'Admins and the Owner',
  owner: 'Only the Owner',
};

export function ApprovalPolicyCard() {
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
      qc.setQueryData(settingsKeys.approvalPolicy(workspace.id), saved);
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Card as="section" className="grid content-start gap-4">
      <CardHeader eyebrow="Approvals" title="Who can approve opening a pull request" />
      {policy.isPending ? (
        <ListSkeleton label="Loading policy" />
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
