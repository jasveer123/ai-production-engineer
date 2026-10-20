'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { INCIDENT_TRANSITIONS, type IncidentStatus, type TimelineEntry } from '@ape/api-contracts';
import { FixPanel } from '@/components/fix-panel';
import { InvestigationReport } from '@/components/investigation-report';
import { VerificationPanel } from '@/components/verification-panel';
import { Badge, Button, Card, ErrorBox, Input, Loading } from '@/components/ui';
import {
  useIncident,
  useServiceCommits,
  useTimeline,
  useTransitionIncident,
  useWorkspace,
} from '@/lib/queries';
import { atLeast } from '@/lib/roles';

const label = (s: string) => s.replace(/_/g, ' ');

const KIND_STYLE: Record<TimelineEntry['kind'], { dot: string; name: string }> = {
  error: { dot: 'bg-danger', name: 'Error' },
  deploy: { dot: 'bg-info', name: 'Deploy' },
  created: { dot: 'bg-accent', name: 'Detected' },
  investigation: { dot: 'bg-info', name: 'AI' },
  fix: { dot: 'bg-ok', name: 'Fix' },
  verification: { dot: 'bg-accent', name: 'Verification' },
  alert: { dot: 'bg-warn', name: 'Alert' },
  status_change: { dot: 'bg-subtle', name: 'Status' },
};

function TimelineItem({ e }: { e: TimelineEntry }) {
  const style = KIND_STYLE[e.kind];
  return (
    <li className="relative pb-5 pl-6">
      <span
        className={`absolute top-1.5 left-0 h-2.5 w-2.5 rounded-full ${style.dot}`}
        aria-hidden
      />
      <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-subtle">
        <span className="font-medium text-fg">{style.name}</span>
        <time dateTime={e.at}>{new Date(e.at).toLocaleString()}</time>
        <span>· {e.source.replace('_', ' ')}</span>
        {e.kind !== 'deploy' && e.actorEmail && <span>· {e.actorEmail}</span>}
      </div>
      <p className="mt-0.5 text-sm">{e.summary}</p>
      {e.kind === 'deploy' && (
        <p className="mt-0.5 font-mono text-xs text-subtle">commit {e.commitSha.slice(0, 7)}</p>
      )}
      {e.kind === 'status_change' && typeof e.attributes.reason === 'string' && (
        <p className="mt-0.5 text-xs text-subtle">“{e.attributes.reason}”</p>
      )}
      {e.kind === 'error' && e.sourceUrl && (
        <a
          href={e.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 inline-block font-mono text-xs text-accent hover:underline"
        >
          trace {e.traceId?.slice(0, 12)} ↗
        </a>
      )}
    </li>
  );
}

function RecentCommits({ workspaceId, serviceId }: { workspaceId: string; serviceId: string }) {
  const commits = useServiceCommits(workspaceId, serviceId);
  return (
    <Card className="mb-6 p-4">
      <p className="mb-2 text-sm font-semibold">Recent commits</p>
      {commits.isPending ? (
        <Loading />
      ) : commits.error ? (
        <p className="text-sm text-warn">{(commits.error as Error).message}</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {commits.data.map((c) => (
            <li key={c.sha} className="flex items-baseline gap-3 py-1.5">
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-accent hover:underline"
              >
                {c.sha.slice(0, 7)}
              </a>
              <span className="min-w-0 flex-1 truncate">{c.message}</span>
              <span className="shrink-0 text-xs text-subtle">{c.author}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function IncidentPage() {
  const { workspaceId, incidentId } = useParams<{ workspaceId: string; incidentId: string }>();
  const ws = useWorkspace(workspaceId);
  const incident = useIncident(workspaceId, incidentId);
  const timeline = useTimeline(workspaceId, incidentId);
  const transition = useTransitionIncident(workspaceId, incidentId);
  const [reason, setReason] = useState('');
  const [showAll, setShowAll] = useState(false);

  if (incident.isPending) return <Loading />;
  if (!incident.data) return <ErrorBox error={incident.error} />;
  const i = incident.data;
  const canAct = atLeast(ws.data?.role, 'engineer');
  const next = INCIDENT_TRANSITIONS[i.status];

  // Long error bursts are collapsed; deploys and status changes always show.
  const entries = timeline.data ?? [];
  const errors = entries.filter((e) => e.kind === 'error');
  const visible = showAll
    ? entries
    : entries.filter((e) => e.kind !== 'error' || errors.indexOf(e) < 5);

  return (
    <div className="max-w-5xl">
      <Link href={`/w/${workspaceId}/incidents`} className="text-sm text-subtle hover:underline">
        ← Incidents
      </Link>
      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone={i.severity}>{i.severity}</Badge>
            <Badge tone={i.status}>{label(i.status)}</Badge>
            <span className="text-xs text-subtle">v{i.version}</span>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight break-words">{i.title}</h1>
          {i.description && <p className="mt-1 text-sm text-subtle">{i.description}</p>}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Service', i.serviceName ? `${i.serviceName} · ${i.environment}` : '—'],
          ['Repository', i.repositoryFullName ?? (i.serviceName ? 'Not mapped' : '—')],
          ['Occurrences', String(i.eventCount)],
          [
            'First → last seen',
            `${new Date(i.firstSeenAt).toLocaleTimeString()} → ${new Date(i.lastSeenAt).toLocaleTimeString()}`,
          ],
        ].map(([k, v]) => (
          <Card key={k} className="p-3">
            <p className="text-xs text-subtle">{k}</p>
            <p
              className={`mt-1 truncate text-sm font-medium ${v === 'Not mapped' ? 'text-warn' : ''}`}
            >
              {v}
            </p>
          </Card>
        ))}
      </div>
      {i.serviceName && !i.serviceId && (
        <div className="mb-6 rounded-md border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          “{i.serviceName}” ({i.environment}) isn’t mapped to a repository, so no code can be
          investigated.{' '}
          <Link href={`/w/${workspaceId}/services`} className="underline">
            Map it on the Services page
          </Link>
          .
        </div>
      )}

      {canAct && next.length > 0 && (
        <Card className="mb-6 p-4">
          <p className="mb-2 text-sm font-medium">Change status</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {next.map((to: IncidentStatus) => (
              <Button
                key={to}
                variant="secondary"
                disabled={transition.isPending}
                onClick={() =>
                  transition.mutate(
                    { to, expectedVersion: i.version, reason: reason || undefined },
                    { onSuccess: () => setReason('') },
                  )
                }
              >
                {label(to)}
              </Button>
            ))}
          </div>
          <div className="mt-2">
            <ErrorBox error={transition.error} />
          </div>
        </Card>
      )}

      <VerificationPanel ws={workspaceId} incidentId={incidentId} />
      <FixPanel ws={workspaceId} incidentId={incidentId} canAct={canAct} />
      <InvestigationReport ws={workspaceId} incidentId={incidentId} canAct={canAct} />

      {i.serviceId && i.repositoryFullName && (
        <RecentCommits workspaceId={workspaceId} serviceId={i.serviceId} />
      )}

      <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
      <Card className="p-4">
        {timeline.isPending ? (
          <Loading />
        ) : (
          <>
            <ol className="border-l border-line pl-1">
              {visible.map((e) => (
                <TimelineItem key={`${e.kind}-${e.id}`} e={e} />
              ))}
            </ol>
            {!showAll && errors.length > 5 && (
              <Button variant="ghost" onClick={() => setShowAll(true)}>
                Show {errors.length - 5} more errors
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
