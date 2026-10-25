'use client';

import type { QualitySummary } from '@ape/api-contracts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Banner } from '@/components/ui/banner';
import { Card, CardHeader, Eyebrow } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { errorMessage } from '@/lib/api';
import { formatCount, formatDuration, formatPercent, formatUsd } from '@/lib/format';
import { MIN_SAMPLE, RANGES, parseDays, ratio } from '../quality';
import { useQuality } from '../queries';

/** How the AI did on this workspace's real incidents, from stored outcomes only (ADR-021). */
export function QualityView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const days = parseDays(params.get('days'));
  const quality = useQuality(days);

  const setDays = (value: string) => {
    const sp = new URLSearchParams(params);
    sp.set('days', value);
    router.replace(`${pathname}?${sp}`);
  };

  return (
    <>
      <PageHeader
        title="Quality"
        description="How well the AI does on your real incidents. Verdicts come from engineers marking each top guess right or wrong; recovery comes from production traffic after the fix shipped."
        actions={
          <label htmlFor="quality-range" className="grid gap-1 text-[13px] font-semibold">
            Time range
            <Select
              id="quality-range"
              value={String(days)}
              onChange={(e) => setDays(e.target.value)}
              className="h-9 w-auto min-w-[150px] font-normal"
            >
              {RANGES.map((d) => (
                <option key={d} value={d}>
                  Last {d} days
                </option>
              ))}
            </Select>
          </label>
        }
      />

      {quality.isPending ? (
        <ListSkeleton label="Loading quality" />
      ) : quality.isError ? (
        <Banner tone="danger" title="Could not load quality.">
          {errorMessage(quality.error)}
        </Banner>
      ) : quality.data.funnel.incidents === 0 ? (
        <EmptyState icon="check" title={`No incidents in the last ${days} days`}>
          Quality is measured on real incidents. Once incidents are investigated and fixed, their
          outcomes show up here. Try a longer time range.
        </EmptyState>
      ) : (
        <Report q={quality.data} />
      )}
    </>
  );
}

/** A rate, or only the counts when there are too few to call it a rate. */
function RatioStat({
  label,
  part,
  whole,
  unit,
}: {
  label: string;
  part: number;
  whole: number;
  unit: string;
}) {
  const r = ratio(part, whole);
  return (
    <Card>
      <Eyebrow>{label}</Eyebrow>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
        {r.kind === 'none'
          ? '—'
          : r.kind === 'few'
            ? `${formatCount(part)} of ${formatCount(whole)}`
            : formatPercent(r.value)}
      </p>
      <p className="m-0 text-[13px] text-ink-muted">
        {r.kind === 'none'
          ? `No ${unit} yet`
          : r.kind === 'few'
            ? `Too few ${unit} for a rate (needs ${MIN_SAMPLE})`
            : `${formatCount(part)} of ${formatCount(whole)} ${unit}`}
      </p>
    </Card>
  );
}

function Report({ q }: { q: QualitySummary }) {
  const fb = q.feedback;
  const inv = q.investigations;
  const funnel = [
    { label: 'Incidents', value: q.funnel.incidents },
    { label: 'Investigated', value: q.funnel.investigated },
    { label: 'Fix validated', value: q.funnel.fixValidated },
    { label: 'PR merged', value: q.funnel.prMerged },
    { label: 'Recovered', value: q.funnel.recovered },
  ];
  return (
    <>
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <RatioStat
          label="Recovered in production"
          part={q.funnel.recovered}
          whole={q.funnel.incidents}
          unit="incidents"
        />
        <Card>
          <Eyebrow>Top guess correct</Eyebrow>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {fb.rated >= MIN_SAMPLE && fb.top1Precision !== null
              ? formatPercent(fb.top1Precision)
              : '—'}
          </p>
          <p className="m-0 text-[13px] text-ink-muted">
            {fb.rated === 0
              ? 'No verdicts yet'
              : `${fb.correct} correct, ${fb.partly} partly, ${fb.wrong} wrong${
                  fb.rated < MIN_SAMPLE ? `; too few for a rate (needs ${MIN_SAMPLE})` : ''
                }`}
          </p>
        </Card>
        <RatioStat
          label="Fixes validated"
          part={q.fixes.validated}
          whole={q.fixes.total}
          unit="fixes"
        />
        <Card>
          <Eyebrow>AI cost and speed</Eyebrow>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {inv.runs ? formatUsd(inv.costUsd) : '—'}
          </p>
          <p className="m-0 text-[13px] text-ink-muted">
            {inv.runs
              ? `${formatCount(inv.runs)} runs, ${
                  inv.avgLatencyMs === null
                    ? 'no timed runs'
                    : `${formatDuration(inv.avgLatencyMs)} average`
                }`
              : 'No investigations yet'}
          </p>
        </Card>
      </div>

      <Card as="section">
        <CardHeader
          eyebrow="Funnel"
          title={`From detection to verified recovery, last ${q.days} days`}
        />
        <dl className="mt-4 grid gap-3">
          {funnel.map((step) => (
            <div
              key={step.label}
              className="grid grid-cols-[120px_minmax(0,1fr)_48px] items-center gap-3"
            >
              <dt className="text-sm">{step.label}</dt>
              <dd className="h-3 overflow-hidden rounded-full bg-surface-sunken">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{ width: `${(step.value / q.funnel.incidents) * 100}%` }}
                />
              </dd>
              <dd className="text-right text-sm font-semibold tabular-nums">
                {formatCount(step.value)}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card as="section" className="grid gap-4">
        <CardHeader eyebrow="Models" title="Each model on your incidents" />
        {q.models.length === 0 ? (
          <p className="m-0 text-ink-muted">No investigations ran in this time range.</p>
        ) : (
          <Table label="Investigations per model">
            <thead>
              <tr>
                <Th>Model</Th>
                <Th className="text-right">Runs</Th>
                <Th className="text-right">Completed</Th>
                <Th>Top guess marked correct</Th>
                <Th className="text-right">Cost</Th>
                <Th className="text-right">Avg latency</Th>
              </tr>
            </thead>
            <tbody>
              {q.models.map((m) => (
                <Tr key={m.model}>
                  <Td className="font-mono text-[13px]">{m.model}</Td>
                  <Td className="text-right tabular-nums">{formatCount(m.runs)}</Td>
                  <Td className="text-right tabular-nums">{formatCount(m.completed)}</Td>
                  <Td className="tabular-nums">
                    {m.top1Rated === 0
                      ? 'No verdicts'
                      : `${m.top1Correct} of ${m.top1Rated}${
                          m.top1Rated >= MIN_SAMPLE
                            ? ` (${formatPercent(m.top1Correct / m.top1Rated)})`
                            : ''
                        }`}
                  </Td>
                  <Td className="text-right tabular-nums">{formatUsd(m.costUsd)}</Td>
                  <Td className="text-right tabular-nums">
                    {m.avgLatencyMs === null ? '—' : formatDuration(m.avgLatencyMs)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="m-0 text-[13px] text-ink-muted">
          Per model, only &ldquo;correct&rdquo; verdicts count. The overall rate above counts
          &ldquo;partly&rdquo; as half.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Card as="section">
          <CardHeader eyebrow="After deploy" title="Recovery checks" />
          <Counts
            rows={[
              ['Recovered', q.verification.recovered],
              ['Not recovered', q.verification.notRecovered],
              ['Inconclusive', q.verification.inconclusive],
            ]}
          />
        </Card>
        <Card as="section">
          <CardHeader eyebrow="Guardrails" title="What the safety checks caught" />
          <Counts
            rows={[
              ['Claims dropped for citing missing evidence', inv.guardRejections],
              ['Investigations sent for review', inv.needsReview],
              ['Investigations that failed', inv.failed],
              ['Fixes that failed validation', q.fixes.validationFailed],
              ['Bugs the test could not reproduce', q.fixes.notReproduced],
            ]}
          />
        </Card>
      </div>
    </>
  );
}

function Counts({ rows }: { rows: [string, number][] }) {
  return (
    <dl className="mt-3 grid gap-2 text-sm">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex justify-between gap-3 border-t border-line pt-2 first:border-t-0"
        >
          <dt>{label}</dt>
          <dd className="font-semibold tabular-nums">{formatCount(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
