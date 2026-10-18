import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { apiEnvSchema, loadEnv } from '@ape/config';
import { AppModule } from './app.module';

async function bootstrap() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = loadEnv(apiEnvSchema);

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(env.API_PORT);
}
void bootstrap();
