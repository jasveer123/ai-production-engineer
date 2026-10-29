'use client';

import { ErrorPanel } from '@/components/ui/error-panel';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} backHref="/" backLabel="Go to Overview" />;
}
