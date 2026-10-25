import type { Integration } from '@ape/api-contracts';

export const CARD =
  'flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-6 shadow-raised max-sm:p-4';
/** Pinned to the bottom so the three cards' footers line up. */
export const FOOTER =
  'mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3';
export const ICON_BUTTON =
  'inline-grid size-8 place-items-center rounded-sm text-ink-muted hover:bg-surface-hover hover:text-ink';
export const ext = 'inline-flex items-center gap-1 font-semibold text-brand hover:underline';
export const STATUS_BADGE: Record<
  Integration['status'],
  { tone: 'ok' | 'danger' | 'warn' | 'neutral'; text: string }
> = {
  connected: { tone: 'ok', text: 'Connected' },
  error: { tone: 'danger', text: 'Needs attention' },
  pending: { tone: 'warn', text: 'Waiting' },
  disconnected: { tone: 'neutral', text: 'Disconnected' },
};
