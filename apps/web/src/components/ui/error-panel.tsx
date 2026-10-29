'use client';

import { ApiError, correlationIdOf } from '@/lib/api';
import { Button, ButtonLink } from './button';
import { CopyButton } from './copy-button';

type ErrorPanelProps = {
  error: unknown;
  reset: () => void;

  backHref?: string;
  backLabel?: string;
};

export function ErrorPanel({ error, reset, backHref, backLabel = 'Go back' }: ErrorPanelProps) {
  const correlationId = correlationIdOf(error);
  return (
    <div
      role="alert"
      className="grid justify-items-center gap-3 rounded-lg border border-line bg-surface-raised px-6 py-12 text-center"
    >
      <h2 className="m-0 font-display text-xl font-semibold">Something went wrong</h2>
      <p className="m-0 max-w-[52ch] text-ink-muted">
        {}
        {error instanceof ApiError ? error.message : 'An unexpected error occurred. Try again.'}
      </p>
      {correlationId && (
        <p className="m-0 flex flex-wrap items-center justify-center gap-2 text-[13px] text-ink-muted">
          Reference <code className="font-mono">{correlationId}</code>
          <CopyButton text={correlationId} label="Copy" />
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        {backHref && (
          <ButtonLink href={backHref} variant="secondary">
            {backLabel}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
