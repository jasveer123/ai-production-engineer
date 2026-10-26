'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Banner } from '@/components/ui/banner';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useSession } from '@/features/auth/session';
import { errorMessage } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { CurrentMonth } from './components/current-month';
import { LimitsForm } from './components/limits-form';
import { usageKeys, useUsage } from './queries';
import { usd } from './usd';

export function UsageView() {
  const { workspace, can } = useSession();
  const qc = useQueryClient();
  const usage = useUsage(can('admin'));

  if (!can('admin')) {
    return (
      <>
        <PageHeader title="Usage" />
        <Banner tone="info" title="Only admins and owners can see usage.">
          Ask a workspace owner if you need to know how much AI time has been used.
        </Banner>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Usage"
        description="AI and sandbox use by month, and the limits that stop costs from running away. Every investigation, automatic or manual, checks these limits before it starts."
      />
      {usage.isPending ? (
        <ListSkeleton label="Loading usage" />
      ) : usage.isError ? (
        <Banner tone="danger" title="Could not load usage.">
          {errorMessage(usage.error)}
        </Banner>
      ) : (
        <>
          {usage.data.blockedReason && (
            <Banner tone="danger" title="New investigations are blocked.">
              Right now {usage.data.blockedReason}
            </Banner>
          )}
          <CurrentMonth summary={usage.data} />
          <LimitsForm
            key={JSON.stringify(usage.data.limits)}
            limits={usage.data.limits}
            canEdit={can('owner')}
            workspaceId={workspace.id}
            onSaved={(next) => qc.setQueryData(usageKeys.all(workspace.id), next)}
          />
          <section aria-labelledby="usage-months" className="grid gap-3">
            <h2 id="usage-months" className="m-0 font-display text-xl font-semibold">
              By month
            </h2>
            <Table label="Usage by month">
              <thead>
                <tr>
                  <Th>Month (UTC)</Th>
                  <Th className="text-right">Investigations</Th>
                  <Th className="text-right">Input tokens</Th>
                  <Th className="text-right">Output tokens</Th>
                  <Th className="text-right">AI cost</Th>
                  <Th className="text-right">Sandbox minutes</Th>
                </tr>
              </thead>
              <tbody>
                {usage.data.months.map((m) => (
                  <Tr key={m.month}>
                    <Td className="font-semibold">{m.month}</Td>
                    <Td className="text-right tabular-nums">{formatCount(m.investigations)}</Td>
                    <Td className="text-right tabular-nums">{formatCount(m.inputTokens)}</Td>
                    <Td className="text-right tabular-nums">{formatCount(m.outputTokens)}</Td>
                    <Td className="text-right tabular-nums">{usd(m.aiCostUsd)}</Td>
                    <Td className="text-right tabular-nums">{formatCount(m.sandboxMinutes)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <p className="m-0 text-[13px] text-ink-muted">
              AI cost is what the model provider charges for investigation reports, from the token
              counts each run reports. Sandbox minutes are the time spent running tests for fixes.
            </p>
          </section>
        </>
      )}
    </>
  );
}
