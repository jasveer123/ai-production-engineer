import type { Metadata } from 'next';
import { DeploysView } from '@/features/deploys/deploys-view';

export const metadata: Metadata = { title: 'Deploys' };

export default function DeploysPage() {
  return <DeploysView />;
}
