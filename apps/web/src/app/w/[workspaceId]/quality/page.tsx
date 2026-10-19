'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { QualitySummary } from '@ape/api-contracts';
import {
  Card,
  EmptyState,
  ErrorBox,
  Loading,
  PageHeader,
  Select,
  Table,
  Td,
} from '@/components/ui';
import { useQuality } from '@/lib/queries';

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');
const usd = (v: number) => (v === 0 ? '$0' : v < 0.01 ? '<$0.01' : `$${v.toFixed(2)}`);
const secs = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`);

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
    </Card>
  );
}

/** Single-hue bars: each stage's length is its share of all incidents in the window. */
function Funnel({ f }: { f: QualitySummary['funnel'] }) {
  const stages: [string, number, string][] = [
    ['Incidents', f.incidents, 'Created in this window'],
    ['Investigated', f.investigated, 'A completed AI report'],
    ['Fix validated', f.fixValidated, 'Regression test and full suite passed in the sandbox'],
    ['PR merged', f.prMerged, 'A human approved and merged the fix'],
    ['Recovered', f.recovered, 'The error stopped after the fix was deployed'],
  ];
  return (
    <ol className="space-y-6" aria-label="Incident funnel">
      {stages.map(([label, n, hint]) => (
        <li
          key={label}
          className="group relative grid grid-cols-[8rem_1fr_6rem] items-center gap-3"
        >
          <span className="text-sm">{label}</span>
          <span
            className="relative h-3 rounded bg-muted"
            tabIndex={0}
            aria-label={`${label}: ${n} of ${f.incidents} (${pct(n, f.incidents)}). ${hint}`}
          >
            <span
              className="absolute inset-y-0 left-0 rounded bg-accent"
              style={{ width: f.incidents ? `${(n / f.incidents) * 100}%` : 0 }}
            />
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-10 hidden rounded-md border border-line bg-surface px-2 py-1 text-xs whitespace-nowrap shadow-sm group-hover:block group-focus-within:block"
            >
              {n} of {f.incidents} · {hint}
            </span>
          </span>
          <span className="text-right text-sm">
            <span className="font-semibold">{n}</span>{' '}
            <span className="text-xs text-subtle">{pct(n, f.incidents)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const OUTCOMES: { key: keyof QualitySummary['verification']; label: string; dot: string }[] = [
  { key: 'recovered', label: 'Recovered', dot: 'bg-ok' },
  { key: 'notRecovered', label: 'Not recovered', dot: 'bg-danger' },
  { key: 'inconclusive', label: 'Inconclusive', dot: 'bg-warn' },
];

export default function QualityPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [days, setDays] = useState(30);
  const q = useQuality(workspaceId, days);

  const range = (
    <div className="w-40">
      <Select
        aria-label="Time range"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
      >
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
      </Select>
    </div>
  );
  const header = (
    <PageHeader
      title="Quality"
      description="How investigations and fixes did on this workspace’s real incidents."
      actions={range}
    />
  );
  if (q.isPending)
    return (
      <div className="max-w-5xl">
        {header}
        <Loading />
      </div>
    );
  if (!q.data)
    return (
      <div className="max-w-5xl">
        {header}
        <ErrorBox error={q.error} />
      </div>
    );

  const d = q.data;
  const inv = d.investigations;
  const fb = d.feedback;
  const verified =
    d.verification.recovered + d.verification.notRecovered + d.verification.inconclusive;

  return (
    <div className="max-w-5xl">
      {header}
      {d.funnel.incidents === 0 ? (
        <Card>
          <EmptyState
            title="No incidents in this window"
            hint="Numbers appear once incidents are detected and investigated."
          />
        </Card>
      ) : (
        <>
          <Card className="mb-4 p-5">
            <p className="text-sm text-subtle">Incidents verified fixed in production</p>
            <p className="mt-1 text-5xl font-semibold">
              {d.funnel.recovered}
              <span className="ml-2 text-lg font-normal text-subtle">
                of {d.funnel.incidents} ({pct(d.funnel.recovered, d.funnel.incidents)})
              </span>
            </p>
          </Card>

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile
              label="Hypothesis #1 correct"
              value={fb.top1Precision === null ? '—' : `${Math.round(fb.top1Precision * 100)}%`}
              hint={fb.rated ? `${fb.rated} rated by engineers` : 'No verdicts yet'}
            />
            <Tile
              label="Fixes validated"
              value={pct(d.fixes.validated, d.fixes.total)}
              hint={`${d.fixes.validated} of ${d.fixes.total} attempts`}
            />
            <Tile
              label="Model cost"
              value={usd(inv.costUsd)}
              hint={`${inv.runs} investigation run${inv.runs === 1 ? '' : 's'}`}
            />
            <Tile
              label="Time to report"
              value={secs(inv.avgLatencyMs)}
              hint="Average model time per run"
            />
          </div>

          <h2 className="mb-2 text-sm font-semibold">From detection to recovery</h2>
          <Card className="mb-6 p-4 pt-8">
            <Funnel f={d.funnel} />
          </Card>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <p className="mb-3 text-sm font-semibold">Recovery verification</p>
              {verified === 0 ? (
                <p className="text-sm text-subtle">No verified deploys yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {OUTCOMES.map((o) => (
                    <li key={o.key} className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${o.dot}`} aria-hidden />
                      <span className="flex-1">{o.label}</span>
                      <span className="font-semibold">{d.verification[o.key]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-4">
              <p className="mb-3 text-sm font-semibold">Guardrails</p>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span>Claims dropped for citing missing evidence</span>
                  <span className="font-semibold">{inv.guardRejections}</span>
                </li>
                <li className="flex justify-between">
                  <span>Runs that ended as “needs review”</span>
                  <span className="font-semibold">{inv.needsReview}</span>
                </li>
                <li className="flex justify-between">
                  <span>Bugs not reproduced (no fix attempted)</span>
                  <span className="font-semibold">{d.fixes.notReproduced}</span>
                </li>
              </ul>
            </Card>
          </div>

          <h2 className="mb-2 text-sm font-semibold">By model</h2>
          <Card className="mb-6">
            <Table head={['Model', 'Runs', 'Completed', '#1 correct', 'Cost', 'Avg time']}>
              {d.models.map((m) => (
                <tr key={m.model}>
                  <Td className="font-mono text-xs">
                    {m.model === 'none' ? (
                      <span className="font-sans text-subtle">No model configured</span>
                    ) : (
                      m.model
                    )}
                  </Td>
                  <Td className="tabular-nums">{m.runs}</Td>
                  <Td className="tabular-nums">{pct(m.completed, m.runs)}</Td>
                  <Td className="tabular-nums">
                    {m.top1Rated ? `${m.top1Correct}/${m.top1Rated}` : '—'}
                  </Td>
                  <Td className="tabular-nums">{usd(m.costUsd)}</Td>
                  <Td className="tabular-nums">{secs(m.avgLatencyMs)}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      )}
      <p className="text-xs text-subtle">
        Offline, the same pipeline is scored against a fixed answer key:{' '}
        <code>make eval MODELS=&quot;gemini:… anthropic:…&quot;</code> (see ADR-021).
      </p>
    </div>
  );
}
