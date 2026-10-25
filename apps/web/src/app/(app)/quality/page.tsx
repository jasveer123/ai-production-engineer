import type { Metadata } from 'next';
import { Suspense } from 'react';
import { QualityView } from '@/features/quality/components/quality-view';

export const metadata: Metadata = { title: 'Quality' };

export default function QualityPage() {
  return (
    <Suspense>
      <QualityView />
    </Suspense>
  );
}
