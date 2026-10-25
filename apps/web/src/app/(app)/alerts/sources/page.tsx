import type { Metadata } from 'next';
import { SourcesView } from '@/features/alerts/components/sources-view';

export const metadata: Metadata = { title: 'Alert sources' };

export default function AlertSourcesPage() {
  return <SourcesView />;
}
