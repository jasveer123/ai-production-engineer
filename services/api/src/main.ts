import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');

import { startTelemetry } from './core/tracing';
startTelemetry();

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiEnvSchema, loadEnv } from '@ape/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const env = loadEnv(apiEnvSchema);
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app, env);

  const doc = new DocumentBuilder()
    .setTitle('AI Production Engineer API')
    .setVersion('0.1.0')
    .addCookieAuth('ape_session')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, doc));

  await app.listen(env.API_PORT);
}
void bootstrap();
