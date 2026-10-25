import type { Incident } from './types';

/** Sample incidents modelled on the demo-shop scenarios. Static preview data, not live. */
export const INCIDENTS: Incident[] = [
  {
    id: 'inc-checkout-coupon',
    flowId: 'checkout',
    causedByChangeId: 'pr-48',
    title: 'Checkout fails for orders without a coupon',
    service: 'checkout-api',
    environment: 'production',
    severity: 'high',
    status: 'fix_ready',
    openedAt: '2026-10-20T10:42:07Z',
    eventCount: 148,
    affectedUsers: 312,
    deploy: { version: 'v1.4.0', commit: 'a1c9e3f', at: '2026-10-20T10:40:02Z' },
    summary:
      'Every POST /checkout without a coupon returns 500 since deploy v1.4.0 turned on the new pricing path.',
    hypotheses: [
      {
        rank: 1,
        title: 'Pricing v2 reads percentOff on a missing coupon',
        explanation:
          'applyDiscount in src/services/pricing.ts reads coupon.percentOff without checking that a coupon exists. The new pricing path made the coupon optional in v1.4.0.',
        confidence: 0.86,
        evidence: [
          'Stack trace: TypeError at applyDiscount (src/services/pricing.ts:41:28)',
          'All 148 failing requests have no couponCode; all requests with a coupon succeed',
          'Errors began 2 minutes after deploy v1.4.0 (commit a1c9e3f)',
        ],
        verdict: 'correct',
      },
      {
        rank: 2,
        title: 'Coupon table migration left rows without a discount',
        explanation:
          'A migration in the same deploy could have left coupons with a null discount. Less likely: the failing requests have no coupon at all.',
        confidence: 0.09,
        evidence: ['Migration 0012 touched the coupons table in v1.4.0'],
      },
    ],
    timeline: [
      {
        at: '2026-10-20T10:40:02Z',
        kind: 'deploy',
        text: 'Deploy v1.4.0 (commit a1c9e3f) to production',
        actor: 'GitHub Actions',
      },
      {
        at: '2026-10-20T10:42:07Z',
        kind: 'detected',
        text: 'Incident opened from 3 matching errors in traces',
        actor: 'Platform',
      },
      {
        at: '2026-10-20T10:42:31Z',
        kind: 'ai',
        text: 'Investigation finished: 2 hypotheses, top one 86% confident',
        actor: 'AI',
      },
      {
        at: '2026-10-20T10:44:10Z',
        kind: 'human',
        text: 'Approved reproduction in the sandbox',
        actor: 'Jasveer Singh',
      },
      {
        at: '2026-10-20T10:45:52Z',
        kind: 'test',
        text: 'New test failed before the patch and passed after it; 64 existing tests pass',
        actor: 'Sandbox',
      },
    ],
    fix: {
      state: 'validated',
      testName: 'checkout without a coupon charges the full price',
      testFile: 'api/src/services/pricing.test.ts',
      diff: `--- a/api/src/services/pricing.ts
+++ b/api/src/services/pricing.ts
@@ -38,7 +38,8 @@ export function applyDiscount(total: number, coupon?: Coupon) {
-  const percent = coupon.percentOff;
-  return total - (total * percent) / 100;
+  if (!coupon) return total;
+  const percent = coupon.percentOff;
+  return total - (total * percent) / 100;
 }`,
      attempts: [
        {
          attempt: 1,
          testBefore: 'failed',
          testAfter: 'passed',
          suite: '64 of 64 existing tests pass',
        },
      ],
    },
    recovery: {
      state: 'waiting',
      note: 'Waiting for the pull request to be approved, merged and deployed.',
    },
    aiCostUsd: 0.31,
  },
  {
    id: 'inc-orders-slow',
    flowId: 'orders-admin',
    causedByChangeId: 'pr-49',
    title: 'Orders admin page takes over 4 seconds',
    service: 'checkout-api',
    environment: 'production',
    severity: 'medium',
    status: 'awaiting_approval',
    openedAt: '2026-10-20T09:15:00Z',
    eventCount: 61,
    affectedUsers: 4,
    deploy: { version: 'v1.3.2', commit: '7be2d10', at: '2026-10-19T17:02:00Z' },
    summary: 'GET /orders p95 rose from 180 ms to 4.2 s as the order count grew.',
    hypotheses: [
      {
        rank: 1,
        title: 'Order items are loaded with one query per order',
        explanation:
          'The inline items view runs a SELECT per order (N+1). Traces show 200+ database spans per request.',
        confidence: 0.74,
        evidence: [
          'Trace 9a1f…: 214 pg spans in one GET /orders',
          'Latency grows with the number of orders',
        ],
      },
    ],
    timeline: [
      {
        at: '2026-10-19T17:02:00Z',
        kind: 'deploy',
        text: 'Deploy v1.3.2 (commit 7be2d10)',
        actor: 'GitHub Actions',
      },
      {
        at: '2026-10-20T09:15:00Z',
        kind: 'detected',
        text: 'Incident opened: p95 latency over 2 s for 10 minutes',
        actor: 'Platform',
      },
      {
        at: '2026-10-20T09:15:40Z',
        kind: 'ai',
        text: 'Investigation finished: 1 hypothesis, 74% confident',
        actor: 'AI',
      },
    ],
    fix: { state: 'none' },
    recovery: { state: 'waiting', note: 'Reproduction is waiting for your approval.' },
    aiCostUsd: 0.22,
  },
  {
    id: 'inc-payment-timeout',
    flowId: 'checkout',
    title: 'Payments time out after a config deploy',
    service: 'checkout-api',
    environment: 'production',
    severity: 'critical',
    status: 'resolved',
    openedAt: '2026-10-18T14:03:00Z',
    resolvedAt: '2026-10-18T14:41:00Z',
    eventCount: 912,
    affectedUsers: 1480,
    deploy: { version: 'v1.3.1', commit: 'c4d81aa', at: '2026-10-18T14:01:00Z' },
    summary: 'PAYMENT_TIMEOUT_MS was set to 5, so almost every checkout failed with 504.',
    hypotheses: [
      {
        rank: 1,
        title: 'Payment timeout set to 5 ms in the deployed config',
        explanation:
          'The same commit was redeployed with PAYMENT_TIMEOUT_MS=5. The payment call never finishes in time.',
        confidence: 0.91,
        evidence: [
          'All failures are 504 after exactly 5 ms',
          'Config changed in deploy v1.3.1; code did not',
        ],
        verdict: 'correct',
      },
    ],
    timeline: [
      {
        at: '2026-10-18T14:01:00Z',
        kind: 'deploy',
        text: 'Deploy v1.3.1 (config only)',
        actor: 'GitHub Actions',
      },
      {
        at: '2026-10-18T14:03:00Z',
        kind: 'detected',
        text: 'Incident opened from 504 errors',
        actor: 'Platform',
      },
      {
        at: '2026-10-18T14:03:35Z',
        kind: 'ai',
        text: 'Investigation finished: config change, not code',
        actor: 'AI',
      },
      {
        at: '2026-10-18T14:20:00Z',
        kind: 'pr',
        text: 'Pull request #41 merged: restore 2000 ms timeout',
        actor: 'Jasveer Singh',
      },
      {
        at: '2026-10-18T14:41:00Z',
        kind: 'verify',
        text: 'Recovered: 0 errors in 15 minutes after deploy v1.3.3',
        actor: 'Platform',
      },
    ],
    fix: {
      state: 'merged',
      testName: 'payment client uses the configured timeout',
      testFile: 'api/src/config.test.ts',
      diff: `--- a/api/.env.production
+++ b/api/.env.production
-PAYMENT_TIMEOUT_MS=5
+PAYMENT_TIMEOUT_MS=2000`,
      attempts: [
        {
          attempt: 1,
          testBefore: 'failed',
          testAfter: 'passed',
          suite: '61 of 61 existing tests pass',
        },
      ],
      prNumber: 41,
      prUrl: 'https://github.com/jasveer123/demo-shop/pull/41',
    },
    recovery: {
      state: 'recovered',
      errorsBefore: 912,
      errorsAfter: 0,
      windowMinutes: 15,
      deployVersion: 'v1.3.3',
    },
    aiCostUsd: 0.18,
  },
  {
    id: 'inc-catalog-page',
    flowId: 'browse',
    causedByChangeId: 'pr-50',
    title: 'First products missing from catalog page 1',
    service: 'storefront-web',
    environment: 'production',
    severity: 'low',
    status: 'needs_attention',
    openedAt: '2026-10-17T11:20:00Z',
    eventCount: 22,
    affectedUsers: 0,
    deploy: { version: 'v2.0.4', commit: '19ab03e', at: '2026-10-17T11:00:00Z' },
    summary:
      'Page-number pagination skips the first page of products. The fix was deployed but errors came back.',
    hypotheses: [
      {
        rank: 1,
        title: 'Offset starts at page × size instead of (page − 1) × size',
        explanation: 'Page 1 starts at offset 20, so the first 20 products never show.',
        confidence: 0.68,
        evidence: ['GET /products?page=1 returns ids 21–40'],
        verdict: 'partly',
      },
    ],
    timeline: [
      {
        at: '2026-10-17T11:20:00Z',
        kind: 'detected',
        text: 'Incident opened from a support alert',
        actor: 'Grafana',
      },
      {
        at: '2026-10-17T12:05:00Z',
        kind: 'pr',
        text: 'Pull request #38 merged',
        actor: 'Jasveer Singh',
      },
      {
        at: '2026-10-17T12:40:00Z',
        kind: 'verify',
        text: 'Not recovered: the same error repeated 4 times after deploy v2.0.5',
        actor: 'Platform',
      },
    ],
    fix: {
      state: 'merged',
      testName: 'page 1 starts at the first product',
      testFile: 'web/src/catalog.test.ts',
      diff: `-  const offset = page * size;
+  const offset = (page - 1) * size;`,
      attempts: [
        {
          attempt: 1,
          testBefore: 'failed',
          testAfter: 'passed',
          suite: '22 of 22 existing tests pass',
        },
      ],
      prNumber: 38,
      prUrl: 'https://github.com/jasveer123/demo-shop/pull/38',
    },
    recovery: {
      state: 'not_recovered',
      errorsBefore: 22,
      errorsAfter: 4,
      windowMinutes: 30,
      deployVersion: 'v2.0.5',
    },
    aiCostUsd: 0.27,
  },
];
