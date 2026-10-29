import { Global, Module } from '@nestjs/common';
import { apiEnvSchema, loadEnv, type ApiEnv } from '@ape/config';

export const ENV = Symbol('ENV');
export type { ApiEnv };

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: (): ApiEnv => loadEnv(apiEnvSchema) }],
  exports: [ENV],
})
export class ConfigModule {}
