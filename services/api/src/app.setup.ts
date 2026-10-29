import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json, raw, text, type Request } from 'express';
import type { ApiEnv } from '@ape/config';

export function configureApp(app: INestApplication, env: ApiEnv): void {
  app.use(cookieParser());

  app.use('/v1', raw({ type: () => true, limit: `${env.INGEST_MAX_BODY_MB}mb`, inflate: true }));

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
