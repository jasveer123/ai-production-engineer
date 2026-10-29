import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
process.env.INGEST_WORKER_ENABLED = 'false';
process.env.OUTBOX_PUBLISHER_ENABLED = 'true';
process.env.REALTIME_ENABLED = 'false';
import { startTelemetry } from './core/tracing';
startTelemetry('ape-temporal-worker');

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NativeConnection, Worker } from '@temporalio/worker';
import { TASK_QUEUES } from '@ape/temporal-workflows';
import { apiEnvSchema, loadEnv } from '@ape/config';
import { AppModule } from './app.module';
import { FixActivitiesService } from './modules/fixes/activities/fix-activities.service';
import { InvestigationActivities } from './modules/investigations/activities/investigation-activities.service';
import { PrActivitiesService } from './modules/pulls/activities/pr-activities.service';
import { VerifyActivitiesService } from './modules/verification/activities/verify-activities.service';

async function main() {
  const env = loadEnv(apiEnvSchema);
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  app.enableShutdownHooks();
  const acts = app.get(InvestigationActivities);
  const fix = app.get(FixActivitiesService);
  const prs = app.get(PrActivitiesService);
  const verify = app.get(VerifyActivitiesService);
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
      prepareFix: fix.prepareFix.bind(fix),
      recordRun: fix.recordRun.bind(fix),
      applyPatch: fix.applyPatch.bind(fix),
      updateFix: fix.updateFix.bind(fix),
      setIncidentStatus: fix.setIncidentStatus.bind(fix),
      testOverlay: fix.testOverlay.bind(fix),
      createPullRequest: prs.createPullRequest.bind(prs),
      beginMonitoring: verify.beginMonitoring.bind(verify),
      findFixDeploy: verify.findFixDeploy.bind(verify),
      startVerification: verify.startVerification.bind(verify),
      evaluateVerification: verify.evaluateVerification.bind(verify),
      noFixDeploy: verify.noFixDeploy.bind(verify),
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
