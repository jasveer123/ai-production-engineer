import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MetricAlertEvaluator } from './application/metric-alert-evaluator.service';
import { MetricAlertRunner } from './application/metric-alert-runner.service';
import { MetricAlertsService } from './application/metric-alerts.service';
import { MetricQueryService } from './application/metric-query.service';
import { MetricsService } from './application/metrics.service';
import { MetricAlertsController } from './metric-alerts.controller';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [WorkspacesModule, AlertsModule],
  controllers: [MetricsController, MetricAlertsController],
  providers: [
    MetricQueryService,
    MetricsService,
    MetricAlertEvaluator,
    MetricAlertsService,
    MetricAlertRunner,
  ],
})
export class MetricsModule {}
