import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import {
  json,
  raw,
  text,
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import type { ApiEnv } from '@ape/config';

export function configureApp(app: INestApplication, env: ApiEnv): void {
  if (env.TRUST_PROXY > 0)
    (app.getHttpAdapter().getInstance() as Application).set('trust proxy', env.TRUST_PROXY);
  app.use(cookieParser());

  app.use('/v1/prometheus', (req: Request, res: Response, next: NextFunction) => {
    const limit = env.INGEST_MAX_BODY_MB * 1024 * 1024;
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        res.status(413).json({ code: 'payload_too_large', message: 'Body is too large' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      (req as Request & { _body?: boolean })._body = true;
      req.body = Buffer.concat(chunks);
      next();
    });
    req.on('error', next);
  });
  const rawBody = raw({ type: () => true, limit: `${env.INGEST_MAX_BODY_MB}mb`, inflate: true });
  app.use('/v1', (req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith('/prometheus/') ? next() : rawBody(req, res, next),
  );

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
  app.use('/v1/rum', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, content-encoding');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  app.enableCors({ origin: env.WEB_URL, credentials: true });
  app.enableShutdownHooks();
}
