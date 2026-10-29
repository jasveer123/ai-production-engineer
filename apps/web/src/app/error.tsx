'use client';

import { LogoMark } from '@/components/shell/logo';
import { ErrorPanel } from '@/components/ui/error-panel';

export default function RootError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="grid w-full max-w-lg justify-items-center gap-4">
        <LogoMark className="size-12" />
        <ErrorPanel error={error} reset={reset} backHref="/" backLabel="Go to Overview" />
      </div>
    </main>
  );
}
