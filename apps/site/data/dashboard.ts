export const PHASE_COUNT = 6;

export const phaseLabels = [
  'Alerting',
  'Investigating',
  'Root cause found',
  'Fix awaiting approval',
  'Deploying fix',
  'Verified',
];

export const phaseTone = ['bad', 'ai', 'ai', 'warn', 'warn', 'good'] as const;

export const reveal = [24, 52, 62, 68, 78, 100];

export const kpis = [
  {
    label: 'Error rate',
    values: ['12.4%', '12.6%', '12.1%', '11.8%', '3.1%', '0.2%'],
    bars: [3, 4, 3, 4, 9, 10, 11, 10, 12, 11],
  },
  {
    label: 'p95 latency',
    values: ['4.8 s', '4.9 s', '4.7 s', '4.6 s', '1.2 s', '210 ms'],
    bars: [2, 3, 2, 3, 8, 11, 10, 12, 11, 12],
  },
  {
    label: 'Requests / min',
    values: ['18.2k', '18.0k', '18.4k', '18.1k', '18.3k', '18.6k'],
    bars: [8, 9, 8, 9, 9, 8, 9, 10, 9, 9],
  },
  {
    label: 'Users affected',
    values: ['2,184', '2,410', '2,530', '2,560', '640', '0'],
    bars: [1, 1, 2, 2, 6, 9, 10, 11, 11, 12],
  },
];

export const recoveredBars = [10, 9, 6, 3, 2, 2, 1, 1, 1, 1];

export const chartSpike =
  '0% 88%, 10% 87%, 17% 88%, 20% 84%, 22% 30%, 26% 36%, 29% 25%, 33% 33%, 37% 22%, 42% 30%, 46% 26%, 50% 20%, 54% 32%, 58% 24%, 62% 30%, 66% 25%, 66% 100%, 0% 100%';

export const chartRecovery =
  '66% 25%, 69% 52%, 72% 75%, 75% 86%, 80% 88%, 90% 87%, 100% 88%, 100% 100%, 66% 100%';

export const markers = [
  { n: 1, x: 22, y: 30, phase: 0, label: 'Alert' },
  { n: 2, x: 50, y: 20, phase: 2, label: 'Cause' },
  { n: 3, x: 66, y: 25, phase: 4, label: 'Fix' },
  { n: 4, x: 86, y: 88, phase: 5, label: 'Verified' },
];

export const logLines = [
  {
    level: 'error',
    time: '02:14:07',
    service: 'checkout',
    text: 'query timeout after 30000ms',
  },
  {
    level: 'warn',
    time: '02:14:07',
    service: 'db-proxy',
    text: 'pool wait 1.9s (20/20 in use)',
  },
  {
    level: 'info',
    time: '02:14:08',
    service: 'cart',
    text: 'GET /cart 200 41ms',
  },
  {
    level: 'error',
    time: '02:14:08',
    service: 'checkout',
    text: 'POST /checkout 504 30012ms',
  },
  {
    level: 'warn',
    time: '02:14:09',
    service: 'payments',
    text: 'upstream retry 2/3',
  },
  {
    level: 'error',
    time: '02:14:09',
    service: 'checkout',
    text: 'connection acquire timeout',
  },
  {
    level: 'info',
    time: '02:14:10',
    service: 'api',
    text: 'GET /health 200 3ms',
  },
  {
    level: 'error',
    time: '02:14:11',
    service: 'checkout',
    text: 'query timeout after 30000ms',
  },
];

export const aiFeed = [
  {
    phase: 0,
    kind: 'alert',
    title: 'Alert from 3 monitors',
    detail: 'checkout-api p95 over 4 s in eu-west, us-east, ap-south',
  },
  {
    phase: 1,
    kind: 'step',
    title: 'Read 1.2M log lines and 342 traces',
    detail: 'checkout, payments, db-proxy · last 30 min',
  },
  {
    phase: 2,
    kind: 'cause',
    title: 'Pool exhausted after deploy #1842',
    detail: 'Query timeout removed in commit a41f2c',
    score: 87,
  },
  {
    phase: 3,
    kind: 'fix',
    title: 'PR #2291 drafted and tested',
    detail: 'Reproduced in sandbox · 128 of 128 tests pass',
  },
  {
    phase: 4,
    kind: 'approve',
    title: 'Approved by on-call and merged',
    detail: 'Deploying to production',
  },
  {
    phase: 5,
    kind: 'proof',
    title: 'Verified in production',
    detail: 'Error rate 0.2% for 30 min · incident closed',
  },
];
