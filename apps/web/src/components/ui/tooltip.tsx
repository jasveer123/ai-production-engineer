'use client';

import * as Primitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export const TooltipProvider = Primitive.Provider;

/** Wraps one focusable child; the label shows on hover and keyboard focus. */
export function Tooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Primitive.Root delayDuration={200}>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          sideOffset={6}
          className="z-50 max-w-64 rounded-md bg-ink px-2.5 py-1.5 text-xs text-surface shadow-overlay"
        >
          {label}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
