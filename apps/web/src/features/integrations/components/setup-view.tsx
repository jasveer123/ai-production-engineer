'use client';

import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { CodeSnippet } from '@/components/ui/code-snippet';
import { LiveStatus } from '@/components/ui/live-status';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { formatAgo, formatCount } from '@/lib/format';
import { useIngestOverview } from '../queries';
import { useRevealedToken } from '../token-context';
import { getSendWay, stepsFor } from '../ways';
import { AutomaticSetup } from '@/features/setup/components/automatic-setup';
import { TokenPanel } from './token-panel';

export function SetupView({ slug }: { slug: string }) {
  const way = getSendWay(slug)!;
  const overview = useIngestOverview();
  const { token, snippetToken } = useRevealedToken();
  const data = overview.data;
  const status = data?.ways.find((w) => w.way === way.apiWay);
  const streams = (data?.streams ?? []).filter(
    (s) => s.way === way.apiWay || (way.apiWay === 'drain' && s.way === 'syslog'),
  );
  const steps = data
    ? stepsFor(slug, { ingestUrl: data.ingestUrl, token: snippetToken, syslog: data.syslog })
    : [];

  return (
    <>
      <Card className="grid gap-1.5 !p-4">
        {!status || status.state === 'not_set_up' ? (
          <LiveStatus state="waiting" detail="usually under a minute after a restart">
            Waiting for your first data
          </LiveStatus>
        ) : status.state === 'receiving' ? (
          <LiveStatus state="live" detail={`last data ${formatAgo(status.lastReceivedAt)}`}>
            Receiving from{' '}
            {streams
              .filter((s) => s.state === 'receiving')
              .map((s) => s.serviceName)
              .join(', ') || 'your app'}
          </LiveStatus>
        ) : (
          <LiveStatus state="error" detail={`last data ${formatAgo(status.lastReceivedAt)}`}>
            No data recently
          </LiveStatus>
        )}
      </Card>

      <div className="max-w-[460px]">
        <TokenPanel />
      </div>
      {!token && (
        <Banner tone="info" title="The snippets show a placeholder for the token.">
          Paste the token you saved when it was created, or rotate it above to see a new one here.
        </Banner>
      )}

      <AutomaticSetup slug={slug} />

      <ol className="grid gap-6">
        {steps.map((step, i) => (
          <li key={step.title} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
            <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-strong">
              {i + 1}
            </span>
            <div className="grid min-w-0 gap-2">
              <b className="font-semibold">{step.title}</b>
              <span className="text-[13px] leading-5 text-ink-muted">{step.detail}</span>
              {step.snippets?.map((s) => (
                <CodeSnippet key={s.label} label={s.label} code={s.code} />
              ))}
            </div>
          </li>
        ))}
      </ol>

      {streams.length > 0 && (
        <Table label="Services sending this way">
          <thead>
            <tr>
              <Th>Service</Th>
              <Th>Status</Th>
              <Th>Logs</Th>
              <Th>Spans</Th>
              <Th>Errors</Th>
              <Th>Last data</Th>
            </tr>
          </thead>
          <tbody>
            {streams.map((s) => (
              <Tr key={`${s.way}-${s.serviceName}-${s.environment}`}>
                <Td>
                  <div className="font-semibold">{s.serviceName}</div>
                  <div className="text-[13px] text-ink-muted">
                    {s.environment}
                    {s.host ? ` · ${s.host}` : ''}
                  </div>
                </Td>
                <Td>
                  <LiveStatus state={s.state === 'receiving' ? 'live' : 'error'}>
                    {s.state === 'receiving' ? 'Receiving' : 'Silent'}
                  </LiveStatus>
                </Td>
                <Td>{formatCount(s.logCount)}</Td>
                <Td>{formatCount(s.spanCount)}</Td>
                <Td>{formatCount(s.errorCount)}</Td>
                <Td className="text-ink-muted">{formatAgo(s.lastReceivedAt)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Banner tone="info" title="We hide secrets before storing anything.">
        Passwords, tokens, emails and card numbers are removed before logs are stored or shown to
        the AI.
      </Banner>
    </>
  );
}
