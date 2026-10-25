import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ServiceImpact } from '@ape/api-contracts';
import { formatMoney, impactFormula, totalsByCurrency } from './money.ts';

const impact = (over: Partial<ServiceImpact>): ServiceImpact => ({
  serviceId: 's',
  serviceName: 'api',
  environment: 'production',
  valuePerRequest: null,
  currency: null,
  failedRequests: 1200,
  errorSpanTraces: 1000,
  incidentErrorEvents: 300,
  incidents: 1,
  impact: null,
  ...over,
});

test('formats money in the service currency, keeping sub-unit values readable', () => {
  assert.equal(formatMoney(2.5, 'INR'), '₹2.50');
  assert.equal(formatMoney(1234.5, 'USD'), '$1,234.50');
  assert.equal(formatMoney(0.0125, 'USD'), '$0.0125');
});

test('spells out the formula only when a value is set', () => {
  assert.equal(impactFormula(impact({})), null);
  assert.equal(
    impactFormula(impact({ valuePerRequest: 2.5, currency: 'INR', impact: 3000 })),
    '1,200 failed requests × ₹2.50 = ₹3,000.00',
  );
});

test('never adds different currencies together', () => {
  const totals = totalsByCurrency([
    impact({ valuePerRequest: 1, currency: 'USD', impact: 10 }),
    impact({ valuePerRequest: 1, currency: 'USD', impact: 5 }),
    impact({ valuePerRequest: 2, currency: 'INR', impact: 40 }),
    impact({}),
  ]);
  assert.deepEqual(totals, [
    { currency: 'USD', total: 15 },
    { currency: 'INR', total: 40 },
  ]);
});
