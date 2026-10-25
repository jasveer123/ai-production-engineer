import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json, raw, text, type Request } from 'express';
import type { ApiEnv } from '@ape/config';

/** Shared by main.ts and the e2e tests so both run the same middleware stack. */
export function configureApp(app: INestApplication, env: ApiEnv): void {
  app.use(cookieParser());
  // Telemetry intake reads raw bytes: protobuf, NDJSON and logplex as well as JSON. Gzip and
  // deflate bodies are inflated here. Runs before the JSON parser, which then skips these routes.
  app.use('/v1', raw({ type: () => true, limit: `${env.INGEST_MAX_BODY_MB}mb`, inflate: true }));
  // Amazon SNS posts JSON as text/plain to alert sources.
  app.use(
    '/ingest/alerts',
    text({
      type: 'text/plain',
      limit: '256kb',
      verify: (req: Request, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(
    json({
      limit: '256kb',
      verify: (req: Request, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.enableCors({ origin: env.WEB_URL, credentials: true });
  app.enableShutdownHooks();
}
