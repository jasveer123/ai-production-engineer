import type { QualitySummary } from '@ape/api-contracts';

export type Row = Record<string, unknown>;
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Math.round(Number(v));

export interface QualityRows {
  funnel: Row | undefined;
  models: Row[];
  votes: Row[];
  fixes: Row | undefined;
  outcomes: Row[];
}

export function buildSummary(days: number, rows: QualityRows): QualitySummary {
  const { funnel, models, votes, fixes, outcomes } = rows;
  const verdict = (model: string | null, v: string) =>
    votes
      .filter((r) => (model === null || r.model === model) && r.verdict === v)
      .reduce((a, r) => a + num(r.n), 0);
  const correct = verdict(null, 'correct');
  const partly = verdict(null, 'partly');
  const wrong = verdict(null, 'wrong');
  const rated = correct + partly + wrong;
  const runs = models.reduce((a, m) => a + num(m.runs), 0);
  const latencyRuns = models.filter((m) => m.avg_latency_ms !== null);
  const outcome = (o: string) => num(outcomes.find((r) => r.outcome === o)?.n);

  return {
    days,
    funnel: {
      incidents: num(funnel?.incidents),
      investigated: num(funnel?.investigated),
      fixValidated: num(funnel?.fix_validated),
      prMerged: num(funnel?.pr_merged),
      recovered: num(funnel?.recovered),
    },
    investigations: {
      runs,
      completed: models.reduce((a, m) => a + num(m.completed), 0),
      needsReview: models.reduce((a, m) => a + num(m.needs_review), 0),
      failed: models.reduce((a, m) => a + num(m.failed), 0),
      guardRejections: models.reduce((a, m) => a + num(m.rejected), 0),
      costUsd: Math.round(models.reduce((a, m) => a + num(m.cost_usd), 0) * 1e6) / 1e6,
      avgLatencyMs: latencyRuns.length
        ? Math.round(
            latencyRuns.reduce((a, m) => a + num(m.avg_latency_ms) * num(m.timed_runs), 0) /
              latencyRuns.reduce((a, m) => a + num(m.timed_runs), 0),
          )
        : null,
    },
    models: models.map((m) => {
      const model = String(m.model);
      return {
        model,
        runs: num(m.runs),
        completed: num(m.completed),
        costUsd: Math.round(num(m.cost_usd) * 1e6) / 1e6,
        avgLatencyMs: numOrNull(m.avg_latency_ms),
        top1Rated: verdict(model, 'correct') + verdict(model, 'partly') + verdict(model, 'wrong'),
        top1Correct: verdict(model, 'correct'),
      };
    }),
    feedback: {
      rated,
      correct,
      partly,
      wrong,
      top1Precision: rated ? Math.round(((correct + partly / 2) / rated) * 1000) / 1000 : null,
    },
    fixes: {
      total: num(fixes?.total),
      validated: num(fixes?.validated),
      validationFailed: num(fixes?.validation_failed),
      notReproduced: num(fixes?.not_reproduced),
    },
    verification: {
      recovered: outcome('recovered'),
      notRecovered: outcome('not_recovered'),
      inconclusive: outcome('inconclusive'),
    },
  };
}
