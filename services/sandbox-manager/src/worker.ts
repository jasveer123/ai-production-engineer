/**
 * Sandbox worker (ADR-007): the only process that starts sandbox containers. It needs Docker and
 * object storage, and deliberately has no database or GitHub credentials.
 */
import { NativeConnection, Worker } from '@temporalio/worker';
import { TASK_QUEUES } from '@ape/temporal-workflows';
import { activities } from './activities';
import { ensureWorkRoot } from './runner';

async function main() {
  ensureWorkRoot();
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  });
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
    taskQueue: TASK_QUEUES.sandbox,
    activities,
    // Bounds concurrent containers on this host.
    maxConcurrentActivityTaskExecutions: 2,
  });
  console.log(`Sandbox worker polling task queue "${TASK_QUEUES.sandbox}"`);
  await worker.run();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
