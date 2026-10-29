export const PREVIEW_NOW = '2026-10-20T10:47:00Z';

export const WORKSPACE = { name: 'Jasveer Shop', plan: 'Team', aiBudgetUsd: 20, aiSpentUsd: 1.84 };

export type Service = {
  name: string;
  repo: string | null;
  environment: 'production' | 'staging';
  source: string;
  state: 'receiving' | 'silent' | 'not_mapped';
  errorRate: number;
  p95Ms: number;
  openIncidents: number;
};

export const SERVICES: Service[] = [
  {
    name: 'checkout-api',
    repo: 'jasveer123/demo-shop',
    environment: 'production',
    source: 'OpenTelemetry',
    state: 'receiving',
    errorRate: 0.042,
    p95Ms: 840,
    openIncidents: 2,
  },
  {
    name: 'orders-worker',
    repo: 'jasveer123/demo-shop',
    environment: 'production',
    source: 'Our package',
    state: 'receiving',
    errorRate: 0.001,
    p95Ms: 220,
    openIncidents: 0,
  },
  {
    name: 'storefront-web',
    repo: 'jasveer123/demo-shop',
    environment: 'production',
    source: 'Grafana Loki',
    state: 'receiving',
    errorRate: 0.004,
    p95Ms: 310,
    openIncidents: 1,
  },
  {
    name: 'nginx-edge',
    repo: null,
    environment: 'production',
    source: 'Server agent',
    state: 'silent',
    errorRate: 0,
    p95Ms: 0,
    openIncidents: 0,
  },
];

export type Alert = {
  id: string;
  title: string;
  source: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  state: 'firing' | 'resolved';
  firedAt: string;
  route: string;
  incidentId?: string;
};

export const ALERTS: Alert[] = [
  {
    id: 'al-1',
    title: 'High 5xx rate on checkout-api',
    source: 'Grafana',
    severity: 'high',
    state: 'firing',
    firedAt: '2026-10-20T10:43:00Z',
    route: 'Production errors → incident',
    incidentId: 'inc-checkout-coupon',
  },
  {
    id: 'al-2',
    title: 'nightly-export heartbeat missed',
    source: 'Heartbeat',
    severity: 'medium',
    state: 'firing',
    firedAt: '2026-10-20T03:05:00Z',
    route: 'Jobs → record only',
  },
  {
    id: 'al-3',
    title: 'TypeError in pricing.ts',
    source: 'Sentry',
    severity: 'high',
    state: 'firing',
    firedAt: '2026-10-20T10:42:30Z',
    route: 'Production errors → incident',
    incidentId: 'inc-checkout-coupon',
  },
  {
    id: 'al-4',
    title: 'p95 latency over 2 s on GET /orders',
    source: 'Grafana',
    severity: 'medium',
    state: 'firing',
    firedAt: '2026-10-20T09:14:00Z',
    route: 'Latency → incident',
    incidentId: 'inc-orders-slow',
  },
  {
    id: 'al-5',
    title: 'Payment 504 spike',
    source: 'Grafana',
    severity: 'critical',
    state: 'resolved',
    firedAt: '2026-10-18T14:02:00Z',
    route: 'Production errors → incident',
    incidentId: 'inc-payment-timeout',
  },
];

export type AlertRoute = {
  order: number;
  name: string;
  when: string;
  then: string;
  active: boolean;
};

export const ALERT_ROUTES: AlertRoute[] = [
  {
    order: 1,
    name: 'Production errors',
    when: 'severity is high or critical, and environment is production',
    then: 'Open an incident, group by service',
    active: true,
  },
  {
    order: 2,
    name: 'Latency',
    when: 'title contains "latency"',
    then: 'Open an incident',
    active: true,
  },
  {
    order: 3,
    name: 'Jobs',
    when: 'source is Heartbeat',
    then: 'Record only, notify #ops',
    active: true,
  },
];

export type Member = {
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Engineer' | 'Viewer';
  joined: string;
  lastActive: string;
};

export const MEMBERS: Member[] = [
  {
    name: 'Jasveer Singh',
    email: 'jasveer@shop.local',
    role: 'Owner',
    joined: '2026-10-02',
    lastActive: 'Now',
  },
  {
    name: 'Aisha Khan',
    email: 'aisha@shop.local',
    role: 'Engineer',
    joined: '2026-10-09',
    lastActive: '2 h ago',
  },
  {
    name: 'Rohan Mehta',
    email: 'rohan@shop.local',
    role: 'Viewer',
    joined: '2026-10-15',
    lastActive: 'Yesterday',
  },
];

export const ROLE_RIGHTS: Array<{ role: Member['role']; can: string }> = [
  {
    role: 'Owner',
    can: 'Everything, including billing, the approval policy and deleting the workspace.',
  },
  { role: 'Admin', can: 'Connect integrations, manage members and settings, approve fixes.' },
  {
    role: 'Engineer',
    can: 'Approve reproductions and pull requests, mark AI answers right or wrong.',
  },
  { role: 'Viewer', can: 'See incidents, logs and reports. Cannot approve or change anything.' },
];

export type AuditEvent = { at: string; actor: string; action: string; target: string };

export const AUDIT_EVENTS: AuditEvent[] = [
  {
    at: '2026-10-20T10:44:10Z',
    actor: 'Jasveer Singh',
    action: 'Approved reproduction',
    target: 'Checkout fails for orders without a coupon',
  },
  {
    at: '2026-10-20T10:42:31Z',
    actor: 'AI',
    action: 'Finished investigation',
    target: 'Checkout fails for orders without a coupon',
  },
  {
    at: '2026-10-20T09:30:00Z',
    actor: 'Jasveer Singh',
    action: 'Connected integration',
    target: 'Grafana (alerts and Loki logs)',
  },
  {
    at: '2026-10-19T16:12:00Z',
    actor: 'Jasveer Singh',
    action: 'Rotated token',
    target: 'Workspace ingest token',
  },
  {
    at: '2026-10-18T14:20:00Z',
    actor: 'Jasveer Singh',
    action: 'Approved pull request',
    target: 'demo-shop #41',
  },
  {
    at: '2026-10-15T11:00:00Z',
    actor: 'Jasveer Singh',
    action: 'Invited member',
    target: 'rohan@shop.local as Viewer',
  },
];

export type QualityStats = {
  incidents: number;
  investigated: number;
  fixValidated: number;
  prMerged: number;
  recovered: number;
  top1Correct: number;
  verdicts: number;
  avgTimeToReportMs: number;
  costUsd: number;
  claimsDropped: number;
  injectionsIgnored: number;
};

export const QUALITY: QualityStats = {
  incidents: 4,
  investigated: 4,
  fixValidated: 3,
  prMerged: 2,
  recovered: 1,
  top1Correct: 2,
  verdicts: 3,
  avgTimeToReportMs: 31_000,
  costUsd: 0.98,
  claimsDropped: 3,
  injectionsIgnored: 1,
};

export type NotificationChannel = {
  name: string;
  kind: 'Slack' | 'Webhook';
  target: string;
  events: string;
  paused: boolean;
};

export const CHANNELS: NotificationChannel[] = [
  {
    name: '#incidents',
    kind: 'Slack',
    target: 'hooks.slack.com/…/T04',
    events: 'New incident, fix ready, recovery result',
    paused: false,
  },
  {
    name: 'PagerDuty bridge',
    kind: 'Webhook',
    target: 'events.example.com/ape',
    events: 'Critical incidents only',
    paused: true,
  },
];

export type SeverityRule = { when: string; severity: 'critical' | 'high' | 'medium' | 'low' };

export const SEVERITY_RULES: SeverityRule[] = [
  { when: 'production and service is checkout-api', severity: 'high' },
  { when: 'production', severity: 'medium' },
  { when: 'staging', severity: 'low' },
];
