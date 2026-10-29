'use client';

import { ErrorPanel } from '@/components/ui/error-panel';

export default function AuthError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} backHref="/login/" backLabel="Back to sign in" />;
}
