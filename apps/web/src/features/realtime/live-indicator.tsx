'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { LiveStatus, type LiveState } from '@/components/ui/live-status';
import { useWorkspaceId } from '@/features/auth/session';
import { apiUrl } from '@/lib/api';

function useLiveUpdates(): LiveState {
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  const [state, setState] = useState<LiveState>('waiting');

  useEffect(() => {
    const source = new EventSource(apiUrl(`/workspaces/${ws}/stream`), { withCredentials: true });
    source.addEventListener('ready', () => setState('live'));
    source.addEventListener('change', () => {
      setState('live');
      void qc.invalidateQueries({ queryKey: ['ws', ws] });
    });
    source.onerror = () => setState('waiting');
    return () => source.close();
  }, [ws, qc]);

  return state;
}

export function LiveIndicator() {
  const state = useLiveUpdates();
  return (
    <span className="max-md:hidden" title="Pages update on their own when something changes">
      <LiveStatus state={state}>{state === 'live' ? 'Live' : 'Reconnecting'}</LiveStatus>
    </span>
  );
}
