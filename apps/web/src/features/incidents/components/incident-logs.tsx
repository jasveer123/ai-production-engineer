'use client';

import { Banner } from '@/components/ui/banner';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LogViewer } from '@/features/logs/components/log-viewer';
import { toViewerLine } from '@/features/logs/components/live-log-explorer';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { incidentLogWindow } from '../live';
import { useIncident, useIncidentLogs } from '../queries';

export function IncidentLogs({ id }: { id: string }) {
  const incident = useIncident(id);
  const logs = useIncidentLogs(incident.data);
  if (incident.isPending) return <p className="text-ink-muted">Loading…</p>;
  if (incident.isError) return null;
  const window = incidentLogWindow(incident.data);

  if (!window)
    return (
      <EmptyState icon="list" title="No service on this incident">
        Logs are matched by service. This incident has none, so there is nothing to show.
      </EmptyState>
    );
  if (logs.isPending) return <p className="text-ink-muted">Loading logs…</p>;
  if (logs.isError)
    return (
      <Banner tone="danger" title="Could not load logs.">
        {errorMessage(logs.error)}
      </Banner>
    );

  const explore = `/logs/?q=${encodeURIComponent(window.q)}`;
  if (logs.data.lines.length === 0)
    return (
      <EmptyState
        icon="list"
        title="No logs from this service at that time"
        action={
          <ButtonLink href={explore} variant="secondary">
            Search all logs
          </ButtonLink>
        }
      >
        {incident.data.serviceName} sent no log lines between {formatDateTime(window.from)} and{' '}
        {formatDateTime(window.to)}. The incident may come from traces or an alert only.
      </EmptyState>
    );

  return (
    <div className="grid gap-3">
      <p className="m-0 text-[13px] text-ink-muted">
        {logs.data.lines.length} newest lines from {incident.data.serviceName}, from{' '}
        {formatDateTime(window.from)} to {formatDateTime(window.to)}.{' '}
        <a href={explore} className="font-semibold text-brand hover:underline">
          Search all logs
        </a>
      </p>
      <LogViewer
        lines={logs.data.lines.map(toViewerLine)}
        label={`Logs for ${incident.data.title}`}
      />
    </div>
  );
}
