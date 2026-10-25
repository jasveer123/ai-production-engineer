import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { LiveLogExplorer } from '@/features/logs/components/live-log-explorer';

export const metadata: Metadata = { title: 'Logs' };

export default function LogsPage() {
  return (
    <>
      <PageHeader
        title="Logs"
        description="Every log from every source, in one place. Secrets are removed before anything is stored. Click a trace id to see one request from start to end."
      />
      <Suspense>
        <LiveLogExplorer />
      </Suspense>
    </>
  );
}
