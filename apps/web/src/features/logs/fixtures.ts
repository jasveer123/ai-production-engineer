import type { LogLine } from './types';

type Seed = Omit<LogLine, 'id' | 'source'> & { source?: LogLine['source'] };

const SEEDS: Seed[] = [
  {
    at: '2026-10-20T10:46:58.204Z',
    level: 'info',
    service: 'checkout-api',
    message: 'GET /products page=2 200 in 14 ms',
  },
  {
    at: '2026-10-20T10:46:51.880Z',
    level: 'warn',
    service: 'nginx-edge',
    message: 'upstream response time 1.21 s /cart',
    source: 'Server agent',
  },
  {
    at: '2026-10-20T10:46:40.117Z',
    level: 'error',
    service: 'checkout-api',
    message: "TypeError: Cannot read properties of undefined (reading 'percentOff')",
    traceId: '77c1d0e93f2a4b10',
    incidentId: 'inc-checkout-coupon',
  },
  {
    at: '2026-10-20T10:46:40.101Z',
    level: 'info',
    service: 'checkout-api',
    message: 'POST /checkout cartId=c_a41 items=1',
  },
  {
    at: '2026-10-20T10:46:22.530Z',
    level: 'info',
    service: 'orders-worker',
    message: 'job order.confirm done in 220 ms',
    source: 'Our package',
  },
  {
    at: '2026-10-20T10:45:58.010Z',
    level: 'debug',
    service: 'checkout-api',
    message: 'cache hit products:page:1',
  },
  {
    at: '2026-10-20T10:45:31.442Z',
    level: 'error',
    service: 'checkout-api',
    message: 'POST /checkout 500 in 29 ms',
    traceId: '5e0b8c21aa904f77',
    incidentId: 'inc-checkout-coupon',
  },
  {
    at: '2026-10-20T10:45:31.420Z',
    level: 'error',
    service: 'checkout-api',
    message:
      "TypeError: Cannot read properties of undefined (reading 'percentOff')\n    at applyDiscount (src/services/pricing.ts:41:28)",
    traceId: '5e0b8c21aa904f77',
    incidentId: 'inc-checkout-coupon',
  },
  {
    at: '2026-10-20T10:44:12.900Z',
    level: 'info',
    service: 'checkout-api',
    message: 'POST /checkout cartId=c_9e7 couponCode=SAVE10 200 in 44 ms',
  },
  {
    at: '2026-10-20T10:43:05.300Z',
    level: 'warn',
    service: 'nginx-edge',
    message: 'upstream response time 1.84 s /products',
    source: 'Server agent',
  },
  {
    at: '2026-10-20T10:42:07.144Z',
    level: 'error',
    service: 'checkout-api',
    message: 'POST /checkout 500 in 31 ms',
    traceId: '4bf92f3577b34da6',
    incidentId: 'inc-checkout-coupon',
    evidence: true,
  },
  {
    at: '2026-10-20T10:42:07.143Z',
    level: 'error',
    service: 'checkout-api',
    message:
      "TypeError: Cannot read properties of undefined (reading 'percentOff')\n    at applyDiscount (src/services/pricing.ts:41:28)",
    traceId: '4bf92f3577b34da6',
    incidentId: 'inc-checkout-coupon',
    evidence: true,
  },
  {
    at: '2026-10-20T10:42:07.141Z',
    level: 'warn',
    service: 'checkout-api',
    message: 'coupon lookup returned no rows couponCode=undefined',
    traceId: '4bf92f3577b34da6',
    incidentId: 'inc-checkout-coupon',
    evidence: true,
  },
  {
    at: '2026-10-20T10:42:07.140Z',
    level: 'debug',
    service: 'checkout-api',
    message: 'pricing v2 enabled for cart c_9f2',
    traceId: '4bf92f3577b34da6',
    incidentId: 'inc-checkout-coupon',
  },
  {
    at: '2026-10-20T10:42:07.112Z',
    level: 'info',
    service: 'checkout-api',
    message: 'POST /checkout cartId=c_9f2 items=3',
    traceId: '4bf92f3577b34da6',
    incidentId: 'inc-checkout-coupon',
  },
  {
    at: '2026-10-20T10:42:06.980Z',
    level: 'info',
    service: 'orders-worker',
    message: 'queue depth 12, oldest job 1.2 s',
    source: 'Our package',
  },
  {
    at: '2026-10-20T10:41:12.000Z',
    level: 'info',
    service: 'checkout-api',
    message: 'GET /products page=1 200 in 12 ms',
  },
  {
    at: '2026-10-20T10:40:02.500Z',
    level: 'info',
    service: 'checkout-api',
    message: 'service started version=v1.4.0 commit=a1c9e3f',
  },
  {
    at: '2026-10-20T10:38:44.000Z',
    level: 'info',
    service: 'storefront-web',
    message: 'GET / 200 in 88 ms',
    source: 'Grafana Loki',
  },
  {
    at: '2026-10-20T10:36:10.000Z',
    level: 'warn',
    service: 'storefront-web',
    message: 'web vitals LCP 3.1 s on /products',
    source: 'Grafana Loki',
  },
  {
    at: '2026-10-20T10:33:51.000Z',
    level: 'info',
    service: 'orders-worker',
    message: 'job order.email done in 410 ms',
    source: 'Our package',
  },
  {
    at: '2026-10-20T10:31:02.000Z',
    level: 'info',
    service: 'checkout-api',
    message: 'POST /checkout cartId=c_9b0 couponCode=WELCOME 200 in 51 ms',
  },
];

/** Sample log lines for the static preview, newest first. */
export const LOG_LINES: LogLine[] = SEEDS.map((seed, i) => ({
  id: `log-${i}`,
  source: 'OpenTelemetry',
  ...seed,
}));

/** Lines replayed by the live tail demo, with fresh timestamps added at runtime. */
export const LIVE_TAIL_SAMPLES: Array<Pick<LogLine, 'level' | 'service' | 'message' | 'source'>> = [
  {
    level: 'info',
    service: 'checkout-api',
    message: 'GET /products page=2 200 in 14 ms',
    source: 'OpenTelemetry',
  },
  {
    level: 'info',
    service: 'orders-worker',
    message: 'job order.confirm done in 220 ms',
    source: 'Our package',
  },
  {
    level: 'error',
    service: 'checkout-api',
    message: "TypeError: Cannot read properties of undefined (reading 'percentOff')",
    source: 'OpenTelemetry',
  },
  {
    level: 'warn',
    service: 'nginx-edge',
    message: 'upstream response time 1.21 s /cart',
    source: 'Server agent',
  },
];

export const LOG_SERVICES = ['checkout-api', 'orders-worker', 'nginx-edge', 'storefront-web'];
