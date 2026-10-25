import type { Metadata } from 'next';
import { ChangesView } from '@/features/changes/changes-view';

export const metadata: Metadata = { title: 'Changes' };

export default function ChangesPage() {
  return <ChangesView />;
}
