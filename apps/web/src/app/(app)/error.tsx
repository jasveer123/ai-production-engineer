'use client';

import { ErrorPanel } from '@/components/ui/error-panel';

/** Inside the app shell, so the navigation stays usable when one page fails. */
export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} backHref="/" backLabel="Go to Overview" />;
}
