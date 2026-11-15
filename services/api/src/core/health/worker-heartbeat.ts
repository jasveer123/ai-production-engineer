import { hostname } from 'node:os';
import type { Database } from '../db/client';
import { workerHeartbeats } from '../db/schema';

export const WORKER_NAMES = ['temporal-worker', 'heartbeat-checker'] as const;
export type WorkerName = (typeof WORKER_NAMES)[number];

export async function recordWorkerBeat(db: Database, name: WorkerName): Promise<void> {
  const now = new Date();
  await db
    .insert(workerHeartbeats)
    .values({ name, host: hostname(), pid: process.pid, beatAt: now })
    .onConflictDoUpdate({
      target: workerHeartbeats.name,
      set: { host: hostname(), pid: process.pid, beatAt: now },
    });
}
