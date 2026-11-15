import { renderAtom, renderRss } from './domain/feed';
import {
  mailOutcome,
  maintenancePhase,
  overallStatus,
  resourceState,
  transitionKey,
} from './domain/projection';

const base = { manualState: null, inMaintenance: false, openImpacts: [] };

describe('status projection', () => {
  it('lets the worst linked monitor win', () => {
    expect(resourceState({ ...base, monitors: [{ state: 'up' }, { state: 'down' }] })).toBe(
      'downtime',
    );
    expect(resourceState({ ...base, monitors: [{ state: 'up' }, { state: 'up' }] })).toBe(
      'operational',
    );
  });

  it('shows unknown instead of up when a monitor has no data or is paused', () => {
    expect(resourceState({ ...base, monitors: [{ state: 'up' }, { state: 'pending' }] })).toBe(
      'unknown',
    );
    expect(resourceState({ ...base, monitors: [{ state: 'up', paused: true }] })).toBe('unknown');
    expect(resourceState({ ...base, monitors: [undefined] })).toBe('unknown');
  });

  it('uses the manual state when no monitor is linked and lets reports raise it', () => {
    expect(resourceState({ ...base, manualState: 'degraded', monitors: [] })).toBe('degraded');
    expect(resourceState({ ...base, monitors: [], openImpacts: ['downtime'] })).toBe('downtime');
    expect(resourceState({ ...base, monitors: [], openImpacts: ['resolved'] })).toBe('operational');
  });

  it('hides downtime while a resource is under maintenance', () => {
    expect(resourceState({ ...base, inMaintenance: true, monitors: [{ state: 'down' }] })).toBe(
      'maintenance',
    );
  });

  it('summarises the page', () => {
    expect(overallStatus(['downtime', 'downtime'])).toBe('outage');
    expect(overallStatus(['downtime', 'operational'])).toBe('degraded');
    expect(overallStatus(['maintenance', 'operational'])).toBe('maintenance');
    expect(overallStatus(['unknown'])).toBe('unknown');
    expect(overallStatus(['unknown', 'operational'])).toBe('operational');
    expect(overallStatus([])).toBe('operational');
  });

  it('places maintenance windows in time', () => {
    const start = new Date('2026-11-14T10:00:00Z');
    const end = new Date('2026-11-14T12:00:00Z');
    expect(maintenancePhase(start, end, new Date('2026-11-14T09:59:59Z'))).toBe('upcoming');
    expect(maintenancePhase(start, end, start)).toBe('in_progress');
    expect(maintenancePhase(start, end, end)).toBe('completed');
  });

  it('keys a transition by monitor, state and the moment it changed', () => {
    expect(transitionKey('m', 'down', 't1')).not.toBe(transitionKey('m', 'down', 't2'));
    expect(transitionKey('m', 'down', 't1')).toBe(transitionKey('m', 'down', 't1'));
  });

  it('reads the mailer outcome whether it returns nothing or a typed result', () => {
    expect(mailOutcome(undefined)).toEqual({ ok: true, error: null });
    expect(mailOutcome({ ok: true })).toEqual({ ok: true, error: null });
    expect(mailOutcome({ ok: false, error: 'HTTP 500' })).toEqual({ ok: false, error: 'HTTP 500' });
    expect(mailOutcome({ status: 'failed' }).ok).toBe(false);
  });

  it('treats the mailer failed and not-configured states as undelivered', () => {
    expect(mailOutcome({ state: 'accepted', providerMessageId: 'm1' }).ok).toBe(true);
    expect(
      mailOutcome({ state: 'failed', transient: true, error: 'SMTP 421', retryAfterMs: null }),
    ).toEqual({
      ok: false,
      error: 'SMTP 421',
    });
    expect(mailOutcome({ state: 'not_configured' }).ok).toBe(false);
  });
});

describe('status feeds', () => {
  const feed = {
    title: 'Acme <status>',
    link: 'https://x.test/status/acme',
    entries: [{ id: 'a', title: 'Down & out', body: 'b', updatedAt: new Date(0) }],
  };
  it('escapes text in Atom and RSS', () => {
    expect(renderAtom(feed, new Date(0))).toContain('Acme &lt;status&gt;');
    expect(renderRss(feed)).toContain('Down &amp; out');
  });
});
