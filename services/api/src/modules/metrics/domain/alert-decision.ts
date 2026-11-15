import type { MetricAlertCondition, MetricAlertState, MissingDataPolicy } from '@ape/api-contracts';

export type Signal = 'breach' | 'ok' | 'no_data' | 'warming_up' | 'error';

export interface SeriesState {
  state: MetricAlertState;
  since: Date;
  pendingSince: Date | null;
}

export interface Timing {
  confirmationSeconds: number;
  recoverySeconds: number;
  missingData: MissingDataPolicy;
}

export interface Decision {
  next: SeriesState;
  transition: 'fire' | 'resolve' | null;
}

export const ANOMALY_HISTORY = 24;
export const ANOMALY_WARMUP = 12;

const elapsed = (from: Date | null, now: Date) =>
  from ? (now.getTime() - from.getTime()) / 1000 : 0;

function onBreach(prev: SeriesState, t: Timing, now: Date): Decision {
  const firing = { state: 'firing' as const, since: now, pendingSince: null };
  if (prev.state === 'firing') return { next: prev, transition: null };
  if (prev.state === 'recovering')
    return { next: { ...prev, state: 'firing', pendingSince: null }, transition: null };
  if (prev.state === 'pending') {
    if (elapsed(prev.pendingSince, now) >= t.confirmationSeconds)
      return { next: firing, transition: 'fire' };
    return { next: prev, transition: null };
  }
  if (t.confirmationSeconds === 0) return { next: firing, transition: 'fire' };
  return { next: { state: 'pending', since: now, pendingSince: now }, transition: null };
}

function onOk(prev: SeriesState, t: Timing, now: Date): Decision {
  const ok = { state: 'ok' as const, since: now, pendingSince: null };
  if (prev.state === 'firing') {
    if (t.recoverySeconds === 0) return { next: ok, transition: 'resolve' };
    return { next: { state: 'recovering', since: now, pendingSince: now }, transition: null };
  }
  if (prev.state === 'recovering') {
    if (elapsed(prev.pendingSince, now) >= t.recoverySeconds)
      return { next: ok, transition: 'resolve' };
    return { next: prev, transition: null };
  }
  if (prev.state === 'ok') return { next: prev, transition: null };
  return { next: ok, transition: null };
}

/** One evaluation step for one series. Errors and warm-up never change alert state. */
export function decide(prev: SeriesState, signal: Signal, t: Timing, now: Date): Decision {
  if (signal === 'error' || signal === 'warming_up') return { next: prev, transition: null };
  if (signal === 'no_data') {
    if (t.missingData === 'alert') return onBreach(prev, t, now);
    if (t.missingData === 'ok') return onOk(prev, t, now);
    return { next: prev, transition: null };
  }
  return signal === 'breach' ? onBreach(prev, t, now) : onOk(prev, t, now);
}

export interface SignalResult {
  signal: Signal;
  value: number | null;
  note: string;
}

const crosses = (op: 'above' | 'below', value: number, limit: number) =>
  op === 'above' ? value > limit : value < limit;

/** `values` are window aggregates, oldest first; the last one is the window being evaluated. */
export function signalOf(values: (number | null)[], c: MetricAlertCondition): SignalResult {
  const current = values[values.length - 1] ?? null;
  if (current === null) return { signal: 'no_data', value: null, note: 'no data in window' };
  if (c.type === 'threshold') {
    const breach = crosses(c.operator, current, c.threshold);
    return { signal: breach ? 'breach' : 'ok', value: current, note: `value ${current}` };
  }
  if (c.type === 'relative') return relativeSignal(values[values.length - 2] ?? null, current, c);
  return anomalySignal(values.slice(0, -1), current, c);
}

function relativeSignal(
  previous: number | null,
  current: number,
  c: MetricAlertCondition,
): SignalResult {
  if (previous === null || previous === 0)
    return { signal: 'no_data', value: current, note: 'no previous window to compare' };
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const breach = c.operator === 'above' ? change > c.threshold : change < -c.threshold;
  return { signal: breach ? 'breach' : 'ok', value: current, note: `change ${change.toFixed(1)}%` };
}

function anomalySignal(history: (number | null)[], current: number, c: MetricAlertCondition) {
  const base = history.filter((v): v is number => v !== null);
  if (base.length < ANOMALY_WARMUP)
    return {
      signal: 'warming_up' as const,
      value: current,
      note: `warming up: ${base.length}/${ANOMALY_WARMUP} windows of history`,
    };
  const mean = base.reduce((a, b) => a + b, 0) / base.length;
  const std = Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / base.length);
  const sigmas =
    std === 0
      ? current === mean
        ? 0
        : Math.sign(current - mean) * Infinity
      : (current - mean) / std;
  const breach = c.operator === 'above' ? sigmas > c.threshold : sigmas < -c.threshold;
  return {
    signal: breach ? ('breach' as const) : ('ok' as const),
    value: current,
    note: `${Number.isFinite(sigmas) ? sigmas.toFixed(2) : sigmas} σ from baseline ${mean.toFixed(3)}`,
  };
}

export function windowsNeeded(c: MetricAlertCondition): number {
  if (c.type === 'threshold') return 1;
  if (c.type === 'relative') return 2;
  return ANOMALY_HISTORY + 1;
}
