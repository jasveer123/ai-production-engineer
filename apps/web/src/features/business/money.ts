import type { ServiceImpact } from '@ape/api-contracts';

export function formatMoney(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: value !== 0 && Math.abs(value) < 1 ? 4 : 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function impactFormula(s: ServiceImpact): string | null {
  if (s.valuePerRequest === null || s.currency === null || s.impact === null) return null;
  return `${s.failedRequests.toLocaleString('en-US')} failed requests × ${formatMoney(s.valuePerRequest, s.currency)} = ${formatMoney(s.impact, s.currency)}`;
}

export function totalsByCurrency(services: ServiceImpact[]): { currency: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const s of services) {
    if (s.impact === null || s.currency === null) continue;
    totals.set(s.currency, (totals.get(s.currency) ?? 0) + s.impact);
  }
  return [...totals].map(([currency, total]) => ({ currency, total }));
}
