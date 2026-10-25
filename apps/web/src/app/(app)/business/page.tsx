import type { Metadata } from 'next';
import { BusinessView } from '@/features/business/business-view';

export const metadata: Metadata = { title: 'Business impact' };

export default function BusinessPage() {
  return <BusinessView />;
}
