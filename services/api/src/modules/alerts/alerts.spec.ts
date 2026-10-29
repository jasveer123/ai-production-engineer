import { mapSeverity, parseAlerts } from './domain/parsers';
import { conditionMatches, groupKey, matchRoute, type RouteLike } from './domain/routing';

const NOW = new Date('2026-10-20T10:00:00Z');

describe('alert parsers', () => {
  it('parses the generic HTTP format with defaults', () => {
    const [a] = parseAlerts(
      'http',
      { title: 'Disk 95% full', severity: 'P2', metadata: { service: 'db', n: 3, nested: {} } },
      NOW,
    );
    expect(a).toMatchObject({
      status: 'firing',
      title: 'Disk 95% full',
      severity: 'high',
      labels: { service: 'db', n: '3' },
      occurredAt: NOW,
    });
    expect(a!.dedupKey).toHaveLength(32);
    expect(() => parseAlerts('http', { description: 'no title' })).toThrow(/title/);
  });

  it('splits an Alertmanager batch and maps firing and resolved', () => {
    const out = parseAlerts(
      'alertmanager',
      {
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'HighErrorRate', service: 'checkout', severity: 'critical' },
            annotations: { summary: 'Checkout 5xx above 5%', description: 'Rate 12%' },
            startsAt: '2026-10-20T09:58:00Z',
            endsAt: '0001-01-01T00:00:00Z',
            generatorURL: 'http://prom:9090/graph?g0.expr=x',
            fingerprint: 'abc123',
          },
          {
            status: 'resolved',
            labels: { alertname: 'Latency' },
            annotations: {},
            endsAt: '2026-10-20T09:59:00Z',
          },
        ],
      },
      NOW,
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      dedupKey: 'abc123',
      status: 'firing',
      title: 'Checkout 5xx above 5%',
      severity: 'critical',
      sourceUrl: 'http://prom:9090/graph?g0.expr=x',
      occurredAt: new Date('2026-10-20T09:58:00Z'),
    });
    expect(out[1]).toMatchObject({
      status: 'resolved',
      title: 'Latency',
      occurredAt: new Date('2026-10-20T09:59:00Z'),
    });
  });

  it('parses Sentry issue and event webhooks', () => {
    const [issue] = parseAlerts('sentry', {
      action: 'resolved',
      data: {
        issue: {
          id: '42',
          title: 'TypeError: x is undefined',
          level: 'error',
          web_url: 'https://sentry.io/i/42',
          project: { slug: 'shop' },
        },
      },
    });
    expect(issue).toMatchObject({
      dedupKey: '42',
      status: 'resolved',
      severity: 'high',
      labels: { project: 'shop' },
    });
    const [event] = parseAlerts('sentry', {
      data: {
        event: {
          event_id: 'e1',
          issue_id: '7',
          title: 'Boom',
          level: 'fatal',
          tags: [['env', 'prod']],
        },
        triggered_rule: 'Prod errors',
      },
    });
    expect(event).toMatchObject({
      dedupKey: '7',
      status: 'firing',
      severity: 'critical',
      labels: { env: 'prod', rule: 'Prod errors' },
    });
  });

  it('parses Datadog webhooks, including recovery and tags', () => {
    const [a] = parseAlerts(
      'datadog',
      {
        title: '[Recovered] CPU high on web-1',
        alert_transition: 'Recovered',
        aggregate: 'agg-9',
        alert_priority: 'P1',
        tags: 'service:web,env:production,canary',
        date: 1792490000,
      },
      NOW,
    );
    expect(a).toMatchObject({
      dedupKey: 'agg-9',
      status: 'resolved',
      severity: 'critical',
      labels: { service: 'web', env: 'production', canary: 'true' },
      occurredAt: new Date(1792490000 * 1000),
    });
  });

  it('maps severity vocabularies', () => {
    expect(['P1', 'fatal', 'critical'].map(mapSeverity)).toEqual([
      'critical',
      'critical',
      'critical',
    ]);
    expect(['warning', 'P3'].map(mapSeverity)).toEqual(['medium', 'medium']);
    expect(['info', 'P5'].map(mapSeverity)).toEqual(['low', 'low']);
    expect(mapSeverity(undefined)).toBe('medium');
  });

  it('rejects unknown kinds and malformed bodies permanently', () => {
    expect(() => parseAlerts('nope', {})).toThrow(/No alert parser/);
    expect(() => parseAlerts('alertmanager', { alerts: [] })).toThrow(/alerts/);
  });
});

describe('alert routing', () => {
  const [alert] = parseAlerts('http', {
    title: 'Checkout errors',
    severity: 'critical',
    metadata: { service: 'checkout', env: 'production', team: 'payments' },
  });
  const route = (over: Partial<RouteLike>): RouteLike => ({
    id: 'r',
    enabled: true,
    position: 0,
    sourceIds: [],
    conditions: [],
    groupBy: [],
    ...over,
  });

  it('evaluates conditions on fields and labels', () => {
    expect(conditionMatches(alert!, { field: 'label.env', op: 'eq', value: 'PRODUCTION' })).toBe(
      true,
    );
    expect(conditionMatches(alert!, { field: 'title', op: 'contains', value: 'checkout' })).toBe(
      true,
    );
    expect(conditionMatches(alert!, { field: 'label.region', op: 'not_exists' })).toBe(true);
    expect(
      conditionMatches(alert!, { field: 'severity', op: 'regex', value: '^(critical|high)$' }),
    ).toBe(true);
    expect(conditionMatches(alert!, { field: 'title', op: 'regex', value: '(' })).toBe(false);
  });

  it('picks the first enabled matching route by position and honours sources', () => {
    const routes = [
      route({ id: 'disabled', position: 0, enabled: false }),
      route({ id: 'other-source', position: 1, sourceIds: ['s2'] }),
      route({
        id: 'staging',
        position: 2,
        conditions: [{ field: 'label.env', op: 'eq', value: 'staging' }],
      }),
      route({
        id: 'prod',
        position: 3,
        conditions: [{ field: 'label.env', op: 'eq', value: 'production' }],
      }),
      route({ id: 'catch-all', position: 4 }),
    ];
    expect(matchRoute(routes, 's1', alert!)?.id).toBe('prod');
    expect(matchRoute([], 's1', alert!)).toBeNull();
  });

  it('groups by label values, or per alert without grouping', () => {
    expect(groupKey(route({ groupBy: ['service', 'env'] }), 's1', alert!)).toBe(
      'service=checkout|env=production',
    );
    expect(groupKey(route({}), 's1', alert!)).toBe(`source=s1|alert=${alert!.dedupKey}`);
  });
});
