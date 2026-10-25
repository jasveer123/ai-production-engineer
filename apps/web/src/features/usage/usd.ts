import { formatMoney } from '@/features/business/money';

export const usd = (v: number) => formatMoney(v, 'USD');
