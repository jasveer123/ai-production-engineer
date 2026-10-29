import { z } from 'zod';
import { coercedInt, optionalText, uuidSchema, type ValueOf } from '../common';

export const HYPOTHESIS_VERDICTS = ['correct', 'partly', 'wrong'] as const;
export type HypothesisVerdict = ValueOf<typeof HYPOTHESIS_VERDICTS>;

export const hypothesisFeedbackSchema = z.object({
  hypothesisId: uuidSchema,
  verdict: z.enum(HYPOTHESIS_VERDICTS),
  note: optionalText(1000),
});
export type HypothesisFeedbackInput = z.infer<typeof hypothesisFeedbackSchema>;

export const qualityQuerySchema = z.object({ days: coercedInt(365, 30) });

type VerdictCounts = Record<HypothesisVerdict, number>;

interface ModelQuality {
  model: string;
  runs: number;
  completed: number;
  costUsd: number;
  avgLatencyMs: number | null;
  top1Rated: number;
  top1Correct: number;
}

export interface QualitySummary {
  days: number;
  funnel: {
    incidents: number;
    investigated: number;
    fixValidated: number;
    prMerged: number;
    recovered: number;
  };
  investigations: {
    runs: number;
    completed: number;
    needsReview: number;
    failed: number;
    guardRejections: number;
    costUsd: number;
    avgLatencyMs: number | null;
  };
  models: ModelQuality[];
  feedback: VerdictCounts & { rated: number; top1Precision: number | null };
  fixes: { total: number; validated: number; validationFailed: number; notReproduced: number };
  verification: { recovered: number; notRecovered: number; inconclusive: number };
}
