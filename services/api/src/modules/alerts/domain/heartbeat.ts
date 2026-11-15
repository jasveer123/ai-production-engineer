export type HeartbeatState = 'pending' | 'up' | 'late' | 'down' | 'paused';
export type HeartbeatSignal = 'success' | 'fail' | 'start';

export interface HeartbeatConfig {
  intervalSeconds: number;
  graceSeconds: number;
  state?: 'pending' | 'up' | 'down';
  paused?: boolean;
  lastPingAt?: string | null;
  windowStartAt?: string | null;
  lastExecutionId?: string | null;
  running?: { executionId: string | null; startedAt: string } | null;
}

export type HeartbeatEmit = { status: 'firing'; cause: string } | { status: 'resolved' } | null;

export interface HeartbeatTransition {
  config: HeartbeatConfig;
  emit: HeartbeatEmit;
  outcome: 'up' | 'recovered' | 'down' | 'started' | 'duplicate' | 'paused' | 'unchanged';
  durationMs: number | null;
}

export interface PingInput {
  signal: HeartbeatSignal;
  at: Date;
  executionId: string | null;
  cause?: string | null;
}

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : null);

export function dueAt(cfg: HeartbeatConfig): Date | null {
  const start = ms(cfg.windowStartAt ?? cfg.lastPingAt);
  return start === null || cfg.paused ? null : new Date(start + cfg.intervalSeconds * 1000);
}

export function evaluateHeartbeat(cfg: HeartbeatConfig, now: Date): HeartbeatState {
  if (cfg.paused) return 'paused';
  if (cfg.state === 'down') return 'down';
  const due = dueAt(cfg);
  if (!due) return 'pending';
  const t = now.getTime();
  if (t < due.getTime()) return 'up';
  return t < due.getTime() + cfg.graceSeconds * 1000 ? 'late' : 'down';
}

function durationOf(cfg: HeartbeatConfig, input: PingInput): number | null {
  const run = cfg.running;
  if (!run) return null;
  if (input.executionId && run.executionId && input.executionId !== run.executionId) return null;
  return Math.max(0, input.at.getTime() - new Date(run.startedAt).getTime());
}

export function applyPing(cfg: HeartbeatConfig, input: PingInput): HeartbeatTransition {
  const at = input.at.toISOString();
  const base = { emit: null, durationMs: null };
  if (input.signal === 'start') {
    return {
      ...base,
      config: { ...cfg, running: { executionId: input.executionId, startedAt: at } },
      outcome: 'started',
    };
  }
  if (cfg.paused)
    return { ...base, config: { ...cfg, lastPingAt: at, running: null }, outcome: 'paused' };
  const durationMs = durationOf(cfg, input);
  if (input.signal === 'fail') {
    const wasDown = cfg.state === 'down';
    return {
      emit: wasDown
        ? null
        : { status: 'firing', cause: input.cause?.trim() || 'The job reported a failure' },
      durationMs,
      config: { ...cfg, state: 'down', lastPingAt: at, windowStartAt: at, running: null },
      outcome: wasDown ? 'unchanged' : 'down',
    };
  }
  if (input.executionId && input.executionId === cfg.lastExecutionId && cfg.state !== 'down')
    return { ...base, config: cfg, outcome: 'duplicate' };
  const recovered = cfg.state === 'down';
  return {
    emit: recovered ? { status: 'resolved' } : null,
    durationMs,
    config: {
      ...cfg,
      state: 'up',
      lastPingAt: at,
      windowStartAt: at,
      lastExecutionId: input.executionId ?? cfg.lastExecutionId ?? null,
      running: null,
    },
    outcome: recovered ? 'recovered' : 'up',
  };
}

export function applyDeadline(cfg: HeartbeatConfig, now: Date): HeartbeatTransition {
  const unchanged: HeartbeatTransition = {
    config: cfg,
    emit: null,
    outcome: 'unchanged',
    durationMs: null,
  };
  if (cfg.state === 'down' || evaluateHeartbeat(cfg, now) !== 'down') return unchanged;
  const last = cfg.lastPingAt ? `Last ping at ${cfg.lastPingAt}.` : 'No ping received.';
  return {
    config: { ...cfg, state: 'down' },
    emit: { status: 'firing', cause: `Missed the expected ping. ${last}` },
    outcome: 'down',
    durationMs: null,
  };
}

export function setPaused(cfg: HeartbeatConfig, paused: boolean, now: Date): HeartbeatConfig {
  if (paused) return { ...cfg, paused: true };
  const everPinged = Boolean(cfg.lastPingAt);
  return { ...cfg, paused: false, windowStartAt: everPinged ? now.toISOString() : null };
}
