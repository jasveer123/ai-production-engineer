import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json, type Request } from 'express';
import type { ApiEnv } from '@ape/config';

/** Shared by main.ts and the e2e tests so both run the same middleware stack. */
export function configureApp(app: INestApplication, env: ApiEnv): void {
  app.use(cookieParser());
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
