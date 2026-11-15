import {
  applyDeadline,
  applyPing,
  evaluateHeartbeat,
  setPaused,
  type HeartbeatConfig,
} from './domain/heartbeat';

const t = (iso: string) => new Date(iso);
const fresh: HeartbeatConfig = { intervalSeconds: 300, graceSeconds: 60, state: 'pending' };
const ping = (cfg: HeartbeatConfig, iso: string, executionId: string | null = null) =>
  applyPing(cfg, { signal: 'success', at: t(iso), executionId });

describe('heartbeat state machine', () => {
  it('stays never-received until the first ping, however long it waits', () => {
    expect(evaluateHeartbeat(fresh, t('2026-11-20T00:00:00Z'))).toBe('pending');
    expect(applyDeadline(fresh, t('2026-11-20T00:00:00Z')).emit).toBeNull();
  });

  it('goes up, late inside grace, then down after period plus grace', () => {
    const up = ping(fresh, '2026-11-14T10:00:00Z').config;
    expect(evaluateHeartbeat(up, t('2026-11-14T10:04:59Z'))).toBe('up');
    expect(evaluateHeartbeat(up, t('2026-11-14T10:05:30Z'))).toBe('late');
    expect(applyDeadline(up, t('2026-11-14T10:05:59Z')).emit).toBeNull();
    const missed = applyDeadline(up, t('2026-11-14T10:06:00Z'));
    expect(missed.emit?.status).toBe('firing');
    expect(evaluateHeartbeat(missed.config, t('2026-11-14T10:06:00Z'))).toBe('down');
  });

  it('opens once: a second deadline check or a repeated failure does not fire again', () => {
    const up = ping(fresh, '2026-11-14T10:00:00Z').config;
    const down = applyDeadline(up, t('2026-11-14T11:00:00Z')).config;
    expect(applyDeadline(down, t('2026-11-14T12:00:00Z')).emit).toBeNull();
    const failed = applyPing(up, {
      signal: 'fail',
      at: t('2026-11-14T10:01:00Z'),
      executionId: null,
      cause: 'disk full',
    });
    expect(failed.emit).toEqual({ status: 'firing', cause: 'disk full' });
    expect(
      applyPing(failed.config, { signal: 'fail', at: t('2026-11-14T10:02:00Z'), executionId: null })
        .emit,
    ).toBeNull();
  });

  it('recovers once when a ping arrives after being down', () => {
    const up = ping(fresh, '2026-11-14T10:00:00Z').config;
    const down = applyDeadline(up, t('2026-11-14T11:00:00Z')).config;
    const back = ping(down, '2026-11-14T11:01:00Z');
    expect(back.emit).toEqual({ status: 'resolved' });
    expect(back.outcome).toBe('recovered');
    expect(ping(back.config, '2026-11-14T11:01:01Z').emit).toBeNull();
  });

  it('treats a repeated execution id as a duplicate', () => {
    const first = ping(fresh, '2026-11-14T10:00:00Z', 'run-1');
    expect(ping(first.config, '2026-11-14T10:00:05Z', 'run-1').outcome).toBe('duplicate');
  });

  it('tracks duration from /start to success', () => {
    const started = applyPing(fresh, {
      signal: 'start',
      at: t('2026-11-14T10:00:00Z'),
      executionId: 'run-2',
    });
    expect(ping(started.config, '2026-11-14T10:00:42Z', 'run-2').durationMs).toBe(42_000);
  });

  it('pausing suppresses alerts and resuming restarts the window', () => {
    const up = ping(fresh, '2026-11-14T10:00:00Z').config;
    const paused = setPaused(up, true, t('2026-11-14T10:01:00Z'));
    expect(evaluateHeartbeat(paused, t('2026-11-15T00:00:00Z'))).toBe('paused');
    expect(applyDeadline(paused, t('2026-11-15T00:00:00Z')).emit).toBeNull();
    const resumed = setPaused(paused, false, t('2026-11-15T00:00:00Z'));
    expect(evaluateHeartbeat(resumed, t('2026-11-15T00:04:00Z'))).toBe('up');
    expect(applyDeadline(resumed, t('2026-11-15T00:06:00Z')).emit?.status).toBe('firing');
    expect(
      evaluateHeartbeat(
        setPaused(
          setPaused(fresh, true, t('2026-11-14T00:00:00Z')),
          false,
          t('2026-11-15T00:00:00Z'),
        ),
        t('2026-11-16T00:00:00Z'),
      ),
    ).toBe('pending');
  });
});
