'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './icon';
import { Tooltip } from './tooltip';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
};

/** Radix dialog: focus trap, Escape, focus return and aria wiring come from the primitive. */
export function Dialog({ open, onClose, title, description, children, wide }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            // Start on the form, not on the close button.
            const field = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
              'input:not([type=hidden]), select, textarea',
            );
            if (field) {
              e.preventDefault();
              field.focus();
            }
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-surface-raised p-0 text-ink shadow-overlay',
            wide ? 'max-w-[640px]' : 'max-w-[480px]',
          )}
        >
          <div className="grid gap-4 p-6 max-sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogPrimitive.Title className="font-display text-lg font-semibold leading-7">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="m-0 mt-1 text-sm text-ink-muted">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              <Tooltip label="Close">
                <DialogPrimitive.Close
                  aria-label="Close"
                  className="grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-hover"
                >
                  <Icon name="x" size="sm" />
                </DialogPrimitive.Close>
              </Tooltip>
            </div>
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
