'use client';

import type { Incident, IncidentStatus } from '@ape/api-contracts';
import Link from 'next/link';
import { WaterfallHero } from '@/components/shared/waterfall-hero';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Card, CardHeader, Eyebrow } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LiveStatus } from '@/components/ui/live-status';
import { useSession } from '@/features/auth/session';
import { SeverityBadge } from '@/features/incidents/components/incident-badges';
import { IncidentStatusBadge } from '@/features/incidents/components/incident-status-badge';
import { useIncidents } from '@/features/incidents/queries';
import { useIngestOverview, useIntegrations } from '@/features/integrations/queries';
import { useDiscoveredServices, useServices } from '@/features/services/queries';
import { errorMessage } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { setupSteps } from '../setup-steps';
import { SetupChecklist } from './setup-checklist';

/** Statuses where the platform is waiting on a person. */
const NEEDS_YOU: IncidentStatus[] = [
  'awaiting_review',
  'needs_attention',
  'validation_failed',
  'verification_inconclusive',
];

/** What needs a person now, what is open, and how far setup has come. */
export function OverviewView() {
  const { me } = useSession();
  const incidents = useIncidents({ status: 'open' });
  const everIncidents = useIncidents({});
  const services = useServices();
  const discovered = useDiscoveredServices();
  const ingest = useIngestOverview();
  const integrations = useIntegrations();

  const open = incidents.data ?? [];
  const needsYou = open.filter((i) => NEEDS_YOU.includes(i.status));
  const sending = [
    ...new Set(
      (ingest.data?.streams ?? []).filter((s) => s.state === 'receiving').map((s) => s.serviceName),
    ),
  ];
  const steps = setupSteps({
    githubConnected: (integrations.data ?? []).some(
      (i) => i.provider === 'github' && i.status === 'connected',
    ),
    // Setup counts any data ever received; the headline counts what is arriving right now.
    sendingServices: [...new Set((ingest.data?.streams ?? []).map((s) => s.serviceName))],
    servicesSetUp: services.data?.length ?? 0,
    servicesWithoutRepo: (services.data ?? []).filter((s) => !s.repositoryFullName).length,
    discoveredNotSetUp: (discovered.data ?? []).map((d) => d.name),
    // Any incident ever, open or closed, counts as having seen the first one.
    incidents: everIncidents.data?.length ?? 0,
  });
  const firstName = me.user.name?.split(' ')[0] ?? me.user.email.split('@')[0];

  return (
    <>
      <WaterfallHero>
        <div className="max-w-[680px]">
          <Eyebrow>Hi {firstName}</Eyebrow>
          <h1 className="mt-1.5 font-display text-[40px] font-bold leading-[44px] tracking-[-0.02em] max-sm:text-[30px] max-sm:leading-9">
            {incidents.isPending
              ? 'Checking your workspace…'
              : needsYou.length
                ? `${needsYou.length} incident${needsYou.length === 1 ? ' needs' : 's need'} you`
                : open.length
                  ? `${open.length} open incident${open.length === 1 ? '' : 's'}, the AI is on ${open.length === 1 ? 'it' : 'them'}`
                  : 'No open incidents'}
          </h1>
          <p className="mt-2 text-ink-muted">
            {sending.length} service{sending.length === 1 ? '' : 's'} sending data
            {discovered.data?.length ? `, ${discovered.data.length} not set up yet` : ''}.
          </p>
        </div>
      </WaterfallHero>

      {incidents.isError && (
        <Banner tone="danger" title="Could not load incidents.">
          {errorMessage(incidents.error)}
        </Banner>
      )}

      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start gap-6 max-lg:grid-cols-1">
        <Card as="section">
          <CardHeader
            eyebrow="Waiting on a person"
            title="Needs you"
            aside={
              <Link href="/incidents/" className="text-sm text-brand hover:underline">
                All incidents
              </Link>
            }
          />
          {needsYou.length ? (
            <IncidentList incidents={needsYou} />
          ) : (
            <p className="m-0 mt-3 text-ink-muted">
              Nothing is waiting for a review or a decision.
            </p>
          )}
        </Card>
        <Card>
          <Eyebrow>Right now</Eyebrow>
          <dl className="mt-3 grid gap-3.5">
            <Row label="Open incidents">
              <Badge tone={open.length ? 'danger' : 'ok'}>{open.length} open</Badge>
            </Row>
            <Row label="Critical or high">
              <span className="font-semibold tabular-nums">
                {open.filter((i) => i.severity === 'critical' || i.severity === 'high').length}
              </span>
            </Row>
            <Row label="Data">
              {sending.length ? (
                <LiveStatus state="live">{sending.length} sending</LiveStatus>
              ) : (
                <LiveStatus state="off">Nothing yet</LiveStatus>
              )}
            </Row>
            <Row label="Services set up">
              <span className="font-semibold tabular-nums">{services.data?.length ?? 0}</span>
            </Row>
          </dl>
        </Card>
      </div>

      <Card as="section">
        <CardHeader eyebrow="Already broken" title="Open incidents" />
        {open.length ? (
          <IncidentList incidents={open.slice(0, 8)} />
        ) : (
          <div className="mt-3">
            <EmptyState icon="flame" title="No open incidents">
              When your services send errors, incidents open here and the AI starts investigating.
            </EmptyState>
          </div>
        )}
      </Card>

      {!steps.every((s) => s.state === 'done') && <SetupChecklist steps={steps} />}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}

function IncidentList({ incidents }: { incidents: Incident[] }) {
  return (
    <ul className="m-0 mt-3 list-none p-0">
      {incidents.map((incident) => (
        <li
          key={incident.id}
          className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0"
        >
          <SeverityBadge severity={incident.severity} />
          <Link
            href={`/incidents/${incident.id}/`}
            className="min-w-0 flex-1 font-semibold hover:text-brand"
          >
            {incident.title}
          </Link>
          <IncidentStatusBadge status={incident.status} />
          <span className="text-[13px] text-ink-muted">{formatAgo(incident.lastSeenAt)}</span>
        </li>
      ))}
    </ul>
  );
}
