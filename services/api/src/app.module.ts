import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AlertsModule } from './alerts/alerts.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { CollectorModule } from './collector/collector.module';
import { ApiErrorFilter } from './common/api-error.filter';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './db/database.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { InvestigationsModule } from './investigations/investigations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QualityModule } from './quality/quality.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SecretsModule } from './secrets/secrets.module';
import { ServiceMappingsModule } from './service-mappings/service-mappings.module';
import { SetupModule } from './setup/setup.module';
import { ToolsModule } from './tools/tools.module';
import { UsageModule } from './usage/usage.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuditModule,
    SecretsModule,
    AuthModule,
    HealthModule,
    WorkspacesModule,
    ServiceMappingsModule,
    IncidentsModule,
    IngestionModule,
    CollectorModule,
    AlertsModule,
    ToolsModule,
    SetupModule,
    InvestigationsModule,
    NotificationsModule,
    RealtimeModule,
    QualityModule,
    DeploymentsModule,
    BusinessModule,
    UsageModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*path');
  }
}
