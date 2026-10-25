import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ChangeDetail } from '@/features/changes/change-detail';

export const metadata: Metadata = { title: 'Change' };

export default async function ChangePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <ChangeDetail sha={(await params).id} />
    </Suspense>
  );
}
