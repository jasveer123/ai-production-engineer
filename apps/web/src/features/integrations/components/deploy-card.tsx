'use client';

import type { Integration, IntegrationWithSecret } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { CodeSnippet } from '@/components/ui/code-snippet';
import { Dialog } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { SetupPrPanel } from '@/features/setup/components/setup-pr-panel';
import { CARD, FOOTER, STATUS_BADGE } from './card-styles';

/** The deploy step for GitHub Actions: an HMAC-signed JSON body, like the server verifies. */
export function deployActionStep(service = 'checkout-api'): string {
  return `- name: Tell AI Production Engineer about this deploy
  env:
    APE_DEPLOY_URL: \${{ secrets.APE_DEPLOY_URL }}
    APE_DEPLOY_SECRET: \${{ secrets.APE_DEPLOY_SECRET }}
  run: |
    body=$(printf '{"service":"${service}","env":"production","commit_sha":"%s","version":"%s"}' "$GITHUB_SHA" "$GITHUB_REF_NAME")
    ts=$(date +%s)
    sig="sha256=$(printf '%s.%s' "$ts" "$body" | openssl dgst -sha256 -hmac "$APE_DEPLOY_SECRET" | sed 's/^.* //')"
    curl -fsS -X POST "$APE_DEPLOY_URL" -H "Content-Type: application/json" \\
      -H "x-ape-timestamp: $ts" -H "x-ape-signature: $sig" -d "$body"`;
}

export function DeployCard({ row }: { row: Integration | undefined }) {
  const { workspace, can } = useSession();
  const admin = can('admin');
  const qc = useQueryClient();
  const [secret, setSecret] = useState<IntegrationWithSecret | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['ws', workspace.id, 'integrations'] });
  const create = useMutation({
    mutationFn: () =>
      row
        ? api<IntegrationWithSecret>(
            `/workspaces/${workspace.id}/integrations/${row.id}/rotate-secret`,
            { method: 'POST' },
          )
        : api<IntegrationWithSecret>(`/workspaces/${workspace.id}/integrations`, {
            method: 'POST',
            json: { provider: 'deploy_webhook', name: 'Deploy pipeline' },
          }),
    onSuccess: (r) => (setSecret(r), setError(null), void refresh()),
    onError: (e) => setError(errorMessage(e)),
  });
  const badge = row ? STATUS_BADGE[row.status] : null;

  return (
    <article className={CARD}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-surface-sunken text-ink">
          <Icon name="send" size="lg" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-base font-semibold">Deploy pipeline</h3>
          <p className="m-0 text-[13px] text-ink-muted">GitHub Actions or any CI</p>
        </div>
        {badge ? (
          <Badge tone={badge.tone}>
            {row!.status === 'pending' ? 'No deploy yet' : badge.text}
          </Badge>
        ) : (
          <Badge>Not connected</Badge>
        )}
      </div>
      <p className="m-0 text-[13px] leading-5 text-ink-muted">
        A signed event for every deploy, so the AI knows which version is live and can check that a
        fix worked.
      </p>
      {admin && (
        <details className="rounded-md border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Set up with a pull request (no secrets)
          </summary>
          <div className="mt-3">
            <SetupPrPanel kind="deploy" />
          </div>
        </details>
      )}
      <FormError>{error}</FormError>
      <div className={FOOTER}>
        <span className="text-[13px] text-ink-muted">
          {row ? `Last deploy ${formatAgo(row.lastSyncAt)}` : 'No deploys yet'}
        </span>
        <div className="flex gap-2">
          <ButtonLink href="/deploys/" size="sm" variant="ghost">
            See deploys
          </ButtonLink>
          {admin && (
            <Button
              size="sm"
              variant={row ? 'secondary' : 'primary'}
              onClick={() =>
                (!row ||
                  window.confirm(
                    'Rotate the signing secret? The old one stops working at once.',
                  )) &&
                create.mutate()
              }
              disabled={create.isPending}
            >
              {row ? 'Rotate secret' : 'Use a signing secret'}
            </Button>
          )}
        </div>
      </div>
      <Dialog
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title="Add these to your CI secrets"
        description="The secret is shown once."
        wide
      >
        {secret && (
          <div className="grid gap-3">
            <CodeSnippet label="APE_DEPLOY_URL" code={secret.webhookUrl ?? ''} />
            <CodeSnippet label="APE_DEPLOY_SECRET" code={secret.signingSecret ?? ''} />
            <CodeSnippet
              label=".github/workflows/deploy.yml (after your deploy step)"
              code={deployActionStep()}
            />
            <div className="flex justify-end">
              <Button onClick={() => setSecret(null)}>Done</Button>
            </div>
          </div>
        )}
      </Dialog>
    </article>
  );
}

/** The repositories the AI can read, plus one short notice per thing GitHub is not allowing. */
