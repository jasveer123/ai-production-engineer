'use client';

import type { IngestTokenWithSecret } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TokenField } from '@/components/ui/code-snippet';
import { FormError } from '@/components/ui/form';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { useIngestOverview } from '../queries';
import { useRevealedToken } from '../token-context';

/** The workspace ingest token every way uses. Shown in full only right after create or rotate. */
export function TokenPanel() {
  const { workspace, can } = useSession();
  const overview = useIngestOverview();
  const { token, setToken } = useRevealedToken();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const current = overview.data?.tokens[0];

  const create = useMutation({
    mutationFn: () =>
      current
        ? api<IngestTokenWithSecret>(
            `/workspaces/${workspace.id}/ingest/tokens/${current.id}/rotate`,
            { method: 'POST' },
          )
        : api<IngestTokenWithSecret>(`/workspaces/${workspace.id}/ingest/tokens`, {
            method: 'POST',
            json: { name: 'Default' },
          }),
    onSuccess: (t) => {
      setError(null);
      setToken(t.token);
      void qc.invalidateQueries({ queryKey: ['ws', workspace.id, 'ingest'] });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  if (overview.isPending) return <p className="text-sm text-ink-muted">Loading your token…</p>;
  if (overview.isError)
    return <FormError>Could not load the ingest token: {errorMessage(overview.error)}</FormError>;

  if (!current)
    return (
      <div className="grid gap-2">
        <span className="text-[13px] font-semibold">Your workspace token</span>
        {can('admin') ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create workspace token'}
            </Button>
            <span className="text-[13px] text-ink-muted">Every way below uses it.</span>
          </div>
        ) : (
          <span className="text-[13px] text-ink-muted">
            No token yet. Ask an admin to create one.
          </span>
        )}
        <FormError>{error}</FormError>
      </div>
    );

  const rotate = () => {
    if (
      window.confirm(
        'Rotate the token? The current one stops working right away, so every app must get the new one.',
      )
    )
      create.mutate();
  };

  return (
    <div className="grid gap-2">
      <TokenField
        label="Your workspace token"
        masked={token ?? current.masked}
        full={token ?? undefined}
        help={
          token
            ? 'Copy it now. It is shown only once; the snippets below already include it.'
            : `Created ${formatAgo(current.createdAt)}, last used ${formatAgo(current.lastUsedAt)}. The full value is only shown when created.`
        }
      />
      {can('admin') && (
        <div>
          <Button size="sm" variant="secondary" onClick={rotate} disabled={create.isPending}>
            {create.isPending ? 'Rotating…' : 'Rotate token'}
          </Button>
        </div>
      )}
      <FormError>{error}</FormError>
    </div>
  );
}
