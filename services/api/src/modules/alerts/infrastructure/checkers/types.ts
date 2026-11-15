import type { CheckTimings, MonitorKind } from '@ape/api-contracts';
import type { OutboundPolicy } from '../../../../core/common/outbound-url';
import type { StoredSettings } from '../../../monitors/domain/monitor-config';

export type CheckTarget = StoredSettings & { monitorKind: MonitorKind };

export interface CheckContext {
  policy: OutboundPolicy;
  basicAuthPassword: string | null;
}

export interface CheckResult {
  ok: boolean;
  statusCode: number | null;
  responseMs: number;
  error: string | null;
  timings: CheckTimings | null;
}

export const failed = (
  error: string,
  started: number,
  statusCode: number | null = null,
): CheckResult => ({
  ok: false,
  statusCode,
  responseMs: Math.round(performance.now() - started),
  error,
  timings: null,
});

export function errorMessage(error: unknown): string {
  const e = error as { name?: string; message?: string; code?: string; cause?: { code?: string } };
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'Timed out';
  return e?.code ?? e?.cause?.code ?? e?.message ?? 'Check failed';
}
