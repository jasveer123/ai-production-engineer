'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icon';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
};

export function Dialog({ open, onClose, title, description, children, wide }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();

      el.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea')?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className={`m-auto w-[calc(100%-32px)] ${wide ? 'max-w-[640px]' : 'max-w-[480px]'} rounded-lg border border-line bg-surface-raised p-0 text-ink shadow-overlay backdrop:bg-black/40`}
    >
      {open && (
        <div className="grid gap-4 p-6 max-sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="dialog-title" className="font-display text-lg font-semibold leading-7">
                {title}
              </h2>
              {description && <p className="m-0 mt-1 text-sm text-ink-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-hover"
            >
              <Icon name="x" size="sm" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
