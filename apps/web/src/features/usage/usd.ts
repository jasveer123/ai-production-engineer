import { formatMoney } from '@/features/business';

export const usd = (v: number) => formatMoney(v, 'USD');
