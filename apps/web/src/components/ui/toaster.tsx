'use client';

import { Toaster as Sonner } from 'sonner';

export { toast } from 'sonner';

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
