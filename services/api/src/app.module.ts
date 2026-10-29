import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AuditModule } from './core/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessModule } from './modules/business/business.module';
import { CollectorModule } from './ingest/collector/collector.module';
import { ApiErrorFilter } from './core/common/api-error.filter';
import { CorrelationIdMiddleware } from './core/common/correlation-id.middleware';
import { ConfigModule } from './core/config/config.module';
import { DatabaseModule } from './core/db/database.module';
import { DeploymentsModule } from './modules/deployments/deployments.module';
import { HealthModule } from './core/health/health.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { IngestionModule } from './ingest/ingestion/ingestion.module';
import { InvestigationsModule } from './modules/investigations/investigations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QualityModule } from './modules/quality/quality.module';
import { RealtimeModule } from './core/realtime/realtime.module';
import { SecretsModule } from './core/secrets/secrets.module';
import { ServiceMappingsModule } from './modules/service-mappings/service-mappings.module';
import { SetupModule } from './connectors/setup/setup.module';
import { ToolsModule } from './connectors/tools/tools.module';
import { UsageModule } from './modules/usage/usage.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';

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
