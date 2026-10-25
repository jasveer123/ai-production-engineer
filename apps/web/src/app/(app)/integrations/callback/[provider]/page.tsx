import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SetupCallback } from '@/features/setup/components/setup-callback';

export const metadata: Metadata = { title: 'Finishing setup' };

export default async function CallbackPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return (
    <Suspense>
      <SetupCallback provider={provider} />
    </Suspense>
  );
}
