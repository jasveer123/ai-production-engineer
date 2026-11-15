import type { IncidentStatus, ResponseState } from '@ape/api-contracts';
import { canTransition, isClosed } from './lifecycle';

export interface ResponseFacts {
  status: IncidentStatus;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}

export type ResponseAction = 'acknowledge' | 'unacknowledge' | 'resolve' | 'reopen';

export type ResponsePlan =
  | { ok: true; to: ResponseState; aiStatus: IncidentStatus | null }
  | { ok: false; code: string; message: string };

// The human response is projected from its own timestamps; a closed AI status only counts as a
// resolution for rows written before resolved_at existed or resolved by the automatic pipeline.
export function responseStateOf(f: ResponseFacts): ResponseState {
  if (f.resolvedAt || isClosed(f.status)) return 'resolved';
  return f.acknowledgedAt ? 'acknowledged' : 'open';
}

// A human resolution must close the AI status too, so grouping and paging (which read it) stop.
export function aiStatusOnResolve(status: IncidentStatus): IncidentStatus | null {
  if (isClosed(status)) return null;
  return canTransition(status, 'resolved') ? 'resolved' : 'closed_without_fix';
}

const refuse = (code: string, message: string): ResponsePlan => ({ ok: false, code, message });

export function planResponse(f: ResponseFacts, action: ResponseAction): ResponsePlan {
  const state = responseStateOf(f);
  switch (action) {
    case 'acknowledge':
      if (state === 'open') return { ok: true, to: 'acknowledged', aiStatus: null };
      return refuse(
        state === 'resolved' ? 'already_resolved' : 'already_acknowledged',
        state === 'resolved' ? 'This incident is already resolved' : 'Already acknowledged',
      );
    case 'unacknowledge':
      if (state === 'acknowledged') return { ok: true, to: 'open', aiStatus: null };
      return refuse(
        'not_acknowledged',
        'Only an acknowledged, unresolved incident can be unacknowledged',
      );
    case 'resolve':
      if (state !== 'resolved')
        return { ok: true, to: 'resolved', aiStatus: aiStatusOnResolve(f.status) };
      return refuse('already_resolved', 'This incident is already resolved');
    case 'reopen':
      if (state === 'resolved')
        return { ok: true, to: 'open', aiStatus: isClosed(f.status) ? 'needs_attention' : null };
      return refuse('not_resolved', 'Only a resolved incident can be reopened');
  }
}
