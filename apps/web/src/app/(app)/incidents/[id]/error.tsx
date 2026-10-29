'use client';

import { ErrorPanel } from '@/components/ui/error-panel';

export default function IncidentError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorPanel error={error} reset={reset} backHref="/incidents/" backLabel="All incidents" />
  );
}
