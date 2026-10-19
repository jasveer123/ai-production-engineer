/**
 * Temporal worker process (ADR-015): runs incident workflows and the `evidence` activities, and
 * publishes the outbox. The HTTP API runs separately (main.ts). Start with `pnpm worker`.
 */
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
process.env.INGEST_WORKER_ENABLED = 'false'; // the API process owns ingestion
process.env.OUTBOX_PUBLISHER_ENABLED = 'true';
import { startTelemetry } from './telemetry';
startTelemetry('ape-temporal-worker');

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NativeConnection, Worker } from '@temporalio/worker';
import { TASK_QUEUES } from '@ape/temporal-workflows';
import { apiEnvSchema, loadEnv } from '@ape/config';
import { AppModule } from './app.module';
import { InvestigationActivities } from './investigations/investigation-activities.service';

async function main() {
  const env = loadEnv(apiEnvSchema);
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  app.enableShutdownHooks();
  const acts = app.get(InvestigationActivities);
  const connection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS });

  const workflows = await Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: TASK_QUEUES.incident,
    workflowsPath: require.resolve('@ape/temporal-workflows/dist/workflows'),
  });
  const activities = await Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: TASK_QUEUES.evidence,
    activities: {
      startInvestigation: acts.startInvestigation.bind(acts),
      collectEvidence: acts.collectEvidence.bind(acts),
      publishReport: acts.publishReport.bind(acts),
      markInvestigation: acts.markInvestigation.bind(acts),
      closeIncident: acts.closeIncident.bind(acts),
      recordReproductionApproval: acts.recordReproductionApproval.bind(acts),
    },
    maxConcurrentActivityTaskExecutions: 10,
  });
  new Logger('Worker').log(
    `Polling task queues "${TASK_QUEUES.incident}" and "${TASK_QUEUES.evidence}"`,
  );
  await Promise.all([workflows.run(), activities.run()]);
  await app.close();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
