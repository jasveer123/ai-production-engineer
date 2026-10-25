import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IncidentsView } from '@/features/incidents/components/incidents-view';

export const metadata: Metadata = { title: 'Incidents' };

export default function IncidentsPage() {
  return (
    <Suspense>
      <IncidentsView />
    </Suspense>
  );
}
