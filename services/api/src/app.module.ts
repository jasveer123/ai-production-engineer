import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ApiErrorFilter } from './common/api-error.filter';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './db/database.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { SecretsModule } from './secrets/secrets.module';
import { ServiceMappingsModule } from './service-mappings/service-mappings.module';
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
  ],
  providers: [{ provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*path');
  }
}
