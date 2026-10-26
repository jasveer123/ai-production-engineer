import { z } from 'zod';

export const HYPOTHESIS_VERDICTS = ['correct', 'partly', 'wrong'] as const;
export type HypothesisVerdict = (typeof HYPOTHESIS_VERDICTS)[number];

export const hypothesisFeedbackSchema = z.object({
  hypothesisId: z.string().uuid(),
  verdict: z.enum(HYPOTHESIS_VERDICTS),
  note: z.string().trim().max(1000).optional(),
});
export type HypothesisFeedbackInput = z.infer<typeof hypothesisFeedbackSchema>;

export const qualityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/** How well the platform did in production over a window, from real outcomes. */
export interface QualitySummary {
  days: number;
  /** Each stage counts incidents that reached it. */
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
  models: {
    model: string;
    runs: number;
    completed: number;
    costUsd: number;
    avgLatencyMs: number | null;
    top1Rated: number;
    top1Correct: number;
  }[];
  /** Verdicts on hypothesis #1. Precision counts "partly" as half. */
  feedback: {
    rated: number;
    correct: number;
    partly: number;
    wrong: number;
    top1Precision: number | null;
  };
  fixes: { total: number; validated: number; validationFailed: number; notReproduced: number };
  /** Final verification outcome per incident. */
  verification: { recovered: number; notRecovered: number; inconclusive: number };
}
