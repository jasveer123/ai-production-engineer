'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { LiveChange } from '@ape/api-contracts';
import { apiUrl } from './api';

// Module state, so every query's refetch interval can see whether the stream is up.
let streamUp = false;
const SAFETY_NET_MS = 30_000;

/** Polls at `fastMs` without a live stream; with one, only a slow safety-net poll remains. */
export const liveInterval = (fastMs: number) => () => (streamUp ? SAFETY_NET_MS : fastMs);

export type LiveState = 'connecting' | 'live' | 'offline';

/**
 * Subscribes to the workspace's SSE stream (Phase 8). Messages only say what changed, so this
 * just invalidates the affected queries and React Query refetches them through the API.
 */
export function useLiveUpdates(ws: string): LiveState {
  const qc = useQueryClient();
  const [state, setState] = useState<LiveState>('connecting');

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const source = new EventSource(apiUrl(`/workspaces/${ws}/stream`), { withCredentials: true });
    const up = (v: boolean) => {
      streamUp = v;
      setState(v ? 'live' : source.readyState === EventSource.CLOSED ? 'offline' : 'connecting');
    };
    source.addEventListener('ready', () => up(true));
    source.addEventListener('change', (e) => {
      let changes: LiveChange[] = [];
      try {
        changes = JSON.parse((e as MessageEvent<string>).data) as LiveChange[];
      } catch {
        return;
      }
      void qc.invalidateQueries({ queryKey: ['workspace', ws, 'incidents'] });
      const ids = new Set(changes.map((c) => c.incidentId).filter((i): i is string => !!i));
      for (const id of ids)
        void qc.invalidateQueries({ queryKey: ['workspace', ws, 'incident', id] });
      if (changes.some((c) => c.table === 'pull_requests'))
        void qc.invalidateQueries({ queryKey: ['workspace', ws, 'pull-requests'] });
    });
    // The browser reconnects by itself; a closed source (e.g. 404 after removal) stays offline.
    source.onerror = () => up(false);
    return () => {
      source.close();
      streamUp = false;
    };
  }, [qc, ws]);

  return state;
}
