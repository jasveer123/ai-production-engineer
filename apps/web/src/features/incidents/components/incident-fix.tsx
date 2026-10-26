'use client';

import type { FixActionInput, PullRequestView, ValidationRunView } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { CodeSnippet } from '@/components/ui/code-snippet';
import { EmptyState } from '@/components/ui/empty-state';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { incidentKeys, useFixes } from '../queries';

/** Workflow phases in which the AI is actually working on a fix. */
const FIXING_PHASES = ['reproduction_approved', 'reproducing', 'patching', 'validating'];
const RUN_TONE = { passed: 'ok', failed: 'danger', error: 'danger', skipped: 'neutral' } as const;
const RUN_LABEL: Record<ValidationRunView['kind'], string> = {
  baseline: 'Baseline (before the fix)',
  reproduction: 'Reproduction test',
  regression: 'Regression check',
  full_suite: 'Full test suite',
  policy: 'Safety policy',
};

/** The proposed patch, the proof it works, and the pull request (FRD FR-08 to FR-11). */
export function IncidentFix({ id }: { id: string }) {
  const { workspace, can } = useSession();
  const qc = useQueryClient();
  const fixes = useFixes(id);
  const [error, setError] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: (body: FixActionInput) =>
      api(`/workspaces/${workspace.id}/incidents/${id}/fixes/actions`, {
        method: 'POST',
        json: body,
      }),
    onSuccess: () => (
      setError(null),
      qc.invalidateQueries({ queryKey: incidentKeys.detail(workspace.id, id) })
    ),
    onError: (e) => setError(errorMessage(e)),
  });

  if (fixes.isPending) return <ListSkeleton label="Loading the fix" />;
  if (fixes.isError)
    return (
      <Banner tone="danger" title="Could not load the fix.">
        {errorMessage(fixes.error)}
      </Banner>
    );
  const { latest: fix, pullRequest, phase } = fixes.data;

  if (!fix)
    return (
      <EmptyState
        icon="shield"
        title={phase && FIXING_PHASES.includes(phase) ? 'Writing a fix' : 'No fix yet'}
      >
        {phase && FIXING_PHASES.includes(phase)
          ? 'The AI is reproducing the bug and writing a fix in the locked sandbox. This page refreshes on its own.'
          : 'The AI writes a fix after an engineer approves reproducing the bug, from the Report tab.'}
      </EmptyState>
    );

  const passed =
    fix.runs.length > 0 && fix.runs.every((r) => r.status !== 'failed' && r.status !== 'error');
  return (
    <div className="grid gap-6">
      {error && (
        <Banner tone="danger" title="That did not work.">
          {error}
        </Banner>
      )}
      {fix.statusReason && (
        <Banner tone="info" title={`Fix ${fix.status.replace(/_/g, ' ')}.`}>
          {fix.statusReason}
        </Banner>
      )}

      <Card as="section" className="grid gap-3">
        <CardHeader
          eyebrow={`Fix version ${fix.version}`}
          title={passed ? 'The test failed before the patch and passes after it' : 'Validation'}
          aside={
            fix.runs.length === 0 ? (
              <Badge>Not validated yet</Badge>
            ) : (
              <Badge tone={passed ? 'ok' : 'danger'}>
                {passed ? 'Validated' : 'Not validated'}
              </Badge>
            )
          }
        />
        {fix.runs.length > 0 && (
          <ul className="m-0 grid list-none gap-2 p-0">
            {fix.runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={RUN_TONE[r.status]}>{r.status}</Badge>
                <span>{RUN_LABEL[r.kind]}</span>
                <span className="text-[13px] text-ink-muted">
                  attempt {r.attempt}
                  {r.durationMs !== null ? `, ${formatDuration(r.durationMs)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {fix.testRationale && <p className="m-0 max-w-[72ch]">{fix.testRationale}</p>}
        {fix.test && <CodeSnippet label={fix.testPath ?? 'New test'} code={fix.test} />}
      </Card>

      {fix.diff && (
        <Card as="section" className="grid gap-3">
          <CardHeader
            eyebrow="Change"
            title="The patch"
            aside={
              fix.diffStat && (
                <span className="text-[13px] text-ink-muted">
                  {fix.diffStat.files} file{fix.diffStat.files === 1 ? '' : 's'}, +
                  {fix.diffStat.additions} −{fix.diffStat.deletions}
                </span>
              )
            }
          />
          {fix.explanation && <p className="m-0 max-w-[72ch]">{fix.explanation}</p>}
          <CodeSnippet label="diff" code={fix.diff} />
          <p className="m-0 text-[13px] text-ink-muted">
            Based on commit <code className="font-mono">{fix.baseCommitSha.slice(0, 7)}</code>
            {fix.repositoryFullName ? ` of ${fix.repositoryFullName}` : ''}.
          </p>
        </Card>
      )}

      {pullRequest ? (
        <PullRequestCard pr={pullRequest} />
      ) : (
        can('engineer') && (
          <Card as="section" className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 max-w-[60ch] text-ink-muted">
              Approving opens one pull request on its own branch. It never pushes to main, and your
              CI runs on it.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={act.isPending}
                onClick={() =>
                  window.confirm('Reject this fix? The incident goes back to needing attention.') &&
                  act.mutate({ action: 'reject' })
                }
              >
                Reject
              </Button>
              <Button
                variant="secondary"
                disabled={act.isPending}
                onClick={() => act.mutate({ action: 'regenerate' })}
              >
                Write another fix
              </Button>
              <Button
                disabled={act.isPending || !passed}
                title={passed ? undefined : 'Only a validated fix can become a pull request'}
                onClick={() => act.mutate({ action: 'approve_pr' })}
              >
                Approve for PR
              </Button>
            </div>
          </Card>
        )
      )}
    </div>
  );
}

const PR_TONE = { open: 'brand', merged: 'ok', closed: 'neutral' } as const;
const CHECKS_TEXT = {
  pending: 'CI running',
  passing: 'CI passing',
  failing: 'CI failing',
  none: 'No CI checks',
} as const;

function PullRequestCard({ pr }: { pr: PullRequestView }) {
  return (
    <Card as="section" className="grid gap-2">
      <CardHeader
        eyebrow="Pull request"
        title={pr.title ?? pr.branchName}
        aside={<Badge tone={PR_TONE[pr.status]}>{pr.status}</Badge>}
      />
      <p className="m-0 text-[13px] text-ink-muted">
        {pr.number !== null ? `#${pr.number}` : 'Opening'} on {pr.repositoryFullName ?? 'GitHub'},
        branch <code className="font-mono">{pr.branchName}</code>. {CHECKS_TEXT[pr.checksStatus]}.
        {pr.approvedBy ? ` Approved by ${pr.approvedBy}.` : ''}
      </p>
      {pr.url && (
        <a
          href={pr.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-brand hover:underline"
        >
          Open on GitHub
        </a>
      )}
    </Card>
  );
}
