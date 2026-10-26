'use client';

import { Toaster as Sonner } from 'sonner';

export { toast } from 'sonner';

/** Mount once in the root layout; call `toast()` from anywhere. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            '!border !border-line !bg-surface-raised !text-ink !shadow-overlay !font-sans !text-sm',
        },
      }}
    />
  );
}
