'use client';

import * as Primitive from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuLabel = ({
  className,
  ...rest
}: ComponentProps<typeof Primitive.Label>) => (
  <Primitive.Label
    className={cn(
      'px-2 pt-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted',
      className,
    )}
    {...rest}
  />
);
export const DropdownMenuSeparator = ({
  className,
  ...rest
}: ComponentProps<typeof Primitive.Separator>) => (
  <Primitive.Separator className={cn('my-1 h-px bg-line', className)} {...rest} />
);

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...rest
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 grid min-w-60 gap-0.5 rounded-lg border border-line bg-surface-raised p-2 text-sm text-ink shadow-overlay',
          className,
        )}
        {...rest}
      />
    </Primitive.Portal>
  );
}

export function DropdownMenuItem({ className, ...rest }: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        'flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-left outline-none data-[highlighted]:bg-surface-hover data-[disabled]:opacity-50',
        className,
      )}
      {...rest}
    />
  );
}
