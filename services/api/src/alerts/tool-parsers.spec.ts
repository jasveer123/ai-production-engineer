import { parseAlerts } from './parsers';

const now = new Date('2026-10-20T10:00:00Z');

describe('alert parsers for connected tools', () => {
  it('Better Stack incident started and resolved', () => {
    const started = parseAlerts(
      'betterstack',
      {
        data: {
          id: '42',
          type: 'incident',
          attributes: {
            name: 'shop.com',
            cause: 'Status 503',
            url: 'https://shop.com',
            started_at: '2026-10-20T09:59:00Z',
            resolved_at: null,
          },
        },
      },
      now,
    );
    expect(started[0]).toMatchObject({
      dedupKey: '42',
      status: 'firing',
      title: 'shop.com: Status 503',
      severity: 'high',
    });
    const resolved = parseAlerts(
      'betterstack',
      { data: { id: '42', attributes: { name: 'shop.com', resolved_at: '2026-10-20T10:00:00Z' } } },
      now,
    );
    expect(resolved[0]!.status).toBe('resolved');
  });

  it('CloudWatch alarm inside an SNS notification', () => {
    const message = {
      AlarmName: 'checkout 5xx',
      AlarmDescription: 'Too many errors',
      AlarmArn: 'arn:aws:cloudwatch:eu-west-1:123:alarm:checkout 5xx',
      NewStateValue: 'ALARM',
      NewStateReason: 'Threshold crossed',
      StateChangeTime: '2026-10-20T09:58:00.000+0000',
      Region: 'EU (Ireland)',
      Trigger: {
        MetricName: '5XXError',
        Namespace: 'AWS/ApplicationELB',
        Dimensions: [{ name: 'service', value: 'checkout-api' }],
      },
    };
    const [a] = parseAlerts(
      'cloudwatch',
      { Type: 'Notification', MessageId: 'm', Message: JSON.stringify(message) },
      now,
    );
    expect(a).toMatchObject({
      status: 'firing',
      title: 'checkout 5xx',
      labels: { service: 'checkout-api', metric: '5XXError', state: 'ALARM' },
    });
    expect(a!.sourceUrl).toContain('eu-west-1.console.aws.amazon.com');
    const [ok] = parseAlerts(
      'cloudwatch',
      { Type: 'Notification', Message: JSON.stringify({ ...message, NewStateValue: 'OK' }) },
      now,
    );
    expect(ok!.status).toBe('resolved');
    expect(() =>
      parseAlerts('cloudwatch', { Type: 'Notification', Message: 'not json' }, now),
    ).toThrow();
  });

  it('Kibana rule webhook', () => {
    const [a] = parseAlerts(
      'elasticsearch',
      {
        rule_id: 'r1',
        rule_name: 'Error spike',
        alert_id: 'checkout-api',
        status: 'threshold met',
        reason: 'count > 50',
        tags: 'service:checkout-api,team:shop',
        url: 'https://kibana.example/r1',
      },
      now,
    );
    expect(a).toMatchObject({
      dedupKey: 'r1:checkout-api',
      status: 'firing',
      labels: { service: 'checkout-api', team: 'shop' },
    });
    const [r] = parseAlerts(
      'elasticsearch',
      { rule_id: 'r1', rule_name: 'Error spike', alert_id: 'checkout-api', status: 'recovered' },
      now,
    );
    expect(r!.status).toBe('resolved');
  });
});
