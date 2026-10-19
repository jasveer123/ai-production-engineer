'use client';

import { useState } from 'react';
import type { FixView, PullRequestView, ValidationRunView } from '@ape/api-contracts';
import { Badge, Button, Card, ErrorBox, Input, Loading } from '@/components/ui';
import { useFixAction, useFixes, useSyncPullRequest } from '@/lib/queries';

const PHASE_TEXT: Record<string, string> = {
  reproduction_approved: 'Preparing the sandbox…',
  reproducing: 'Reproducing the bug in the sandbox…',
  patching: 'Generating a minimal patch…',
  validating: 'Validating the patch in the sandbox…',
  awaiting_fix_decision: 'Waiting for your decision',
  pr_approved: 'Approved: opening the pull request…',
  pr_open: 'Pull request open: waiting for review and merge',
  pr_merged: 'Pull request merged',
  fix_rejected: 'Fix rejected',
};

const STATUS_TONE: Record<string, string> = {
  validated: 'success',
  validation_failed: 'denied',
  not_reproduced: 'failure',
  baseline_failed: 'failure',
  error: 'denied',
  rejected: 'disconnected',
};

const KIND_LABEL: Record<ValidationRunView['kind'], string> = {
  baseline: 'Existing tests (before any change)',
  reproduction: 'Regression test fails on current code',
  policy: 'Policy checks',
  regression: 'Regression test after patch',
  full_suite: 'Full test suite after patch',
};

const RUN_TONE: Record<ValidationRunView['status'], string> = {
  passed: 'success',
  failed: 'denied',
  error: 'failure',
  skipped: 'disconnected',
};

function runDetail(r: ValidationRunView): string {
  const s = r.summary as {
    tests?: number;
    failures?: number;
    errors?: number;
    reason?: string;
    violations?: string[];
  };
  if (r.kind === 'policy')
    return s.violations?.length ? s.violations.join('; ') : 'Diff within limits';
  if (r.kind === 'reproduction')
    return r.status === 'passed'
      ? 'Bug reproduced: the new test fails on current code'
      : String(s.reason ?? '');
  const parts = [];
  if (typeof s.tests === 'number')
    parts.push(`${s.tests - (s.failures ?? 0) - (s.errors ?? 0)}/${s.tests} passed`);
  if (s.reason) parts.push(String(s.reason).replace(/_/g, ' '));
  if (r.durationMs) parts.push(`${(r.durationMs / 1000).toFixed(1)}s`);
  return parts.join(' · ');
}

function Code({ text, diff = false }: { text: string; diff?: boolean }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-md border border-line bg-bg p-3 font-mono text-xs leading-relaxed">
      {text.split('\n').map((line, i) => {
        const tone = !diff
          ? ''
          : line.startsWith('+') && !line.startsWith('+++')
            ? 'bg-ok/15 text-ok'
            : line.startsWith('-') && !line.startsWith('---')
              ? 'bg-danger/15 text-danger'
              : line.startsWith('@@')
                ? 'text-info'
                : '';
        return (
          <div key={i} className={`whitespace-pre ${tone}`}>
            {line || ' '}
          </div>
        );
      })}
    </pre>
  );
}

function Runs({ fix }: { fix: FixView }) {
  if (fix.runs.length === 0) return null;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs uppercase tracking-wide text-subtle">
        <tr>
          <th className="py-1.5 font-medium">Check</th>
          <th className="py-1.5 font-medium">Attempt</th>
          <th className="py-1.5 font-medium">Result</th>
          <th className="py-1.5 font-medium">Details</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {fix.runs.map((r) => (
          <tr key={r.id}>
            <td className="py-2">{KIND_LABEL[r.kind]}</td>
            <td className="py-2 text-subtle">{r.attempt || '—'}</td>
            <td className="py-2">
              <Badge tone={RUN_TONE[r.status]}>{r.status}</Badge>
            </td>
            <td className="py-2 text-xs text-subtle">{runDetail(r)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FixPanel({
  ws,
  incidentId,
  canAct,
}: {
  ws: string;
  incidentId: string;
  canAct: boolean;
}) {
  const q = useFixes(ws, incidentId);
  const action = useFixAction(ws, incidentId);
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<'patch' | 'test'>('patch');
  if (q.isPending) return null;
  const data = q.data;
  const fix = data?.latest;
  const phase = data?.phase ?? '';
  if (!fix && !['reproduction_approved', 'reproducing', 'awaiting_fix_decision'].includes(phase))
    return null;
  const busy = ['reproduction_approved', 'reproducing', 'patching', 'validating'].includes(phase);
  const deciding = phase === 'awaiting_fix_decision';
  const run = (a: 'regenerate' | 'reject' | 'approve_pr') =>
    action.mutate({ action: a, note: note || undefined }, { onSuccess: () => setNote('') });

  return (
    <section className="mb-6 space-y-4" aria-label="Reproduction and fix">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              Reproduction & fix{fix ? ` v${fix.version}` : ''}{' '}
              {fix && <Badge tone={STATUS_TONE[fix.status]}>{fix.status.replace(/_/g, ' ')}</Badge>}
              {busy && (
                <span
                  className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent"
                  aria-hidden
                />
              )}
            </p>
            <p className="mt-0.5 text-xs text-subtle">
              {PHASE_TEXT[phase] ?? phase.replace(/_/g, ' ')}
              {fix &&
                ` · ${fix.repositoryFullName} @ ${fix.baseCommitSha.slice(0, 7)} · isolated sandbox, no network`}
              {fix && fix.patchAttempts > 0 && ` · ${fix.patchAttempts} patch attempt(s)`}
            </p>
          </div>
          {canAct && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-8 w-56"
                placeholder="Note or reason (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                variant="secondary"
                className="h-8"
                disabled={!deciding || action.isPending}
                onClick={() => run('regenerate')}
              >
                Regenerate
              </Button>
              <Button
                className="h-8"
                disabled={!deciding || fix?.status !== 'validated' || action.isPending}
                onClick={() => run('approve_pr')}
              >
                Approve for PR
              </Button>
              <Button
                variant="danger"
                className="h-8"
                disabled={!(deciding || phase === 'pr_open') || action.isPending}
                onClick={() => run('reject')}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
        <div className="mt-2">
          <ErrorBox error={action.error} />
        </div>
        {fix?.statusReason && (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-sm ${fix.status === 'validated' ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'}`}
          >
            {fix.statusReason}
          </p>
        )}
        {!fix && busy && <Loading label="Starting…" />}
        {fix && (
          <div className="mt-4">
            <Runs fix={fix} />
          </div>
        )}
      </Card>

      {data?.pullRequest && <PullRequestCard ws={ws} pr={data.pullRequest} canAct={canAct} />}

      {fix && (fix.diff || fix.test) && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <Button
              variant={tab === 'patch' ? 'secondary' : 'ghost'}
              className="h-8"
              onClick={() => setTab('patch')}
              disabled={!fix.diff}
            >
              Patch{fix.diffStat ? ` (+${fix.diffStat.additions} −${fix.diffStat.deletions})` : ''}
            </Button>
            <Button
              variant={tab === 'test' ? 'secondary' : 'ghost'}
              className="h-8"
              onClick={() => setTab('test')}
              disabled={!fix.test}
            >
              Regression test
            </Button>
          </div>
          {tab === 'patch' && fix.diff && (
            <>
              {fix.explanation && <p className="mb-3 text-sm">{fix.explanation}</p>}
              <Code text={fix.diff} diff />
            </>
          )}
          {tab === 'test' && fix.test && (
            <>
              <p className="mb-1 font-mono text-xs text-subtle">{fix.testPath}</p>
              {fix.testRationale && <p className="mb-3 text-sm">{fix.testRationale}</p>}
              <Code text={fix.test} />
            </>
          )}
        </Card>
      )}
    </section>
  );
}

export const PR_TONE: Record<string, string> = {
  open: 'success',
  merged: 'success',
  closed: 'disconnected',
  passing: 'success',
  failing: 'denied',
  pending: 'pending',
  none: 'disconnected',
};

export function PullRequestCard({
  ws,
  pr,
  canAct,
}: {
  ws: string;
  pr: PullRequestView;
  canAct: boolean;
}) {
  const sync = useSyncPullRequest(ws);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            Pull request{' '}
            {pr.url ? (
              <a
                className="text-accent hover:underline"
                href={pr.url}
                target="_blank"
                rel="noreferrer"
              >
                #{pr.number}
              </a>
            ) : (
              'pending'
            )}{' '}
            <Badge tone={PR_TONE[pr.status]}>{pr.status}</Badge>{' '}
            <Badge tone={PR_TONE[pr.checksStatus]}>checks {pr.checksStatus}</Badge>
          </p>
          <p className="mt-0.5 truncate text-xs text-subtle">
            {pr.title} · <span className="font-mono">{pr.branchName}</span> →{' '}
            <span className="font-mono">{pr.baseBranch}</span>
            {pr.approvedBy && <> · approved by {pr.approvedBy}</>}
            {pr.lastSyncedAt && <> · synced {new Date(pr.lastSyncedAt).toLocaleTimeString()}</>}
          </p>
        </div>
        {canAct && (
          <Button
            variant="secondary"
            className="h-8"
            disabled={sync.isPending}
            onClick={() => sync.mutate(pr.id)}
          >
            {sync.isPending ? 'Syncing…' : 'Sync now'}
          </Button>
        )}
      </div>
      <ErrorBox error={sync.error} />
      {pr.checks.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {pr.checks.map((c) => (
            <li key={c.name} className="flex items-center gap-2">
              <Badge
                tone={
                  PR_TONE[
                    c.conclusion === 'success' ? 'passing' : c.conclusion ? 'failing' : 'pending'
                  ]
                }
              >
                {c.conclusion ?? c.status}
              </Badge>
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
