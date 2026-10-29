import { randomUUID } from 'node:crypto';
import { heartbeat } from '@temporalio/activity';
import type { SandboxActivities, SandboxProfile, SandboxRunResult } from '@ape/temporal-workflows';
import { ensureDepsImage, runSuite } from './runner';
import { getJson, materializeSource, putJson } from './storage';

async function withHeartbeat<T>(fn: () => Promise<T>): Promise<T> {
  const t = setInterval(() => {
    try {
      heartbeat();
    } catch {}
  }, 5000);
  try {
    return await fn();
  } finally {
    clearInterval(t);
  }
}

export const activities: SandboxActivities = {
  async prepareImage({ sourceRef, profile }: { sourceRef: string; profile: SandboxProfile }) {
    return withHeartbeat(async () => {
      const dir = await materializeSource(sourceRef);
      return { image: await ensureDepsImage(dir, profile) };
    });
  },

  async runSuite(input): Promise<SandboxRunResult> {
    return withHeartbeat(async () => {
      const dir = await materializeSource(input.sourceRef);
      const overlay = input.overlayRef
        ? (await getJson<{ files: Record<string, string> }>(input.overlayRef)).files
        : null;
      const r = await runSuite({
        image: input.image,
        sourceDir: dir,
        overlay,
        profile: input.profile,
        only: input.only,
      });
      const outputRef = await putJson(`sandbox-runs/${input.label}-${randomUUID()}.json`, {
        label: input.label,
        image: input.image,
        only: input.only,
        ...r,
      });
      return {
        status: r.status,
        reason: r.reason,
        exitCode: r.exitCode,
        durationMs: r.durationMs,
        summary: r.summary,
        outputRef,
      };
    });
  },
};
