import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FixesView } from '@/features/fixes/components/fixes-view';

export const metadata: Metadata = { title: 'Fixes & PRs' };

export default function FixesPage() {
  return (
    <Suspense>
      <FixesView />
    </Suspense>
  );
}
