import type { Metadata } from 'next';
import { RoutesView } from '@/features/alerts/components/routes-view';

export const metadata: Metadata = { title: 'Alert routes' };

export default function AlertRoutesPage() {
  return <RoutesView />;
}
