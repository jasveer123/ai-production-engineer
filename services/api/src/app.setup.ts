import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import {
  json,
  raw,
  text,
  urlencoded,
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import type { ApiEnv } from '@ape/config';

const SENTRY_PATH = /^\/api\/\d+\/(envelope|store)\/?$/;

// Browser SDKs must read the status to retry; the app-wide CORS middleware would replace the wildcard origin.
function publicCors(methods: string, headers: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', headers);
    res.setHeader('Access-Control-Expose-Headers', 'retry-after, x-sentry-rate-limits');
    res.setHeader('Access-Control-Max-Age', '86400');
    const set = res.setHeader.bind(res);
    res.setHeader = ((name: string, value: number | string | readonly string[]) =>
      name.toLowerCase() === 'access-control-allow-origin' ||
      name.toLowerCase() === 'access-control-allow-credentials'
        ? res
        : set(name, value)) as typeof res.setHeader;
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

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

  app.use((req: Request, res: Response, next: NextFunction) =>
    SENTRY_PATH.test(req.path) ? rawBody(req, res, next) : next(),
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
    '/ingest/heartbeats',
    text({
      type: (req) => !/json/i.test(String(req.headers['content-type'] ?? '')),
      limit: '64kb',
      verify: (req: Request, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use('/notifications/twilio', urlencoded({ extended: false, limit: '64kb' }));
  app.use(
    json({
      limit: '256kb',
      verify: (req: Request, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use('/v1/rum', publicCors('GET, POST, OPTIONS', 'content-type, content-encoding'));
  app.use((req: Request, res: Response, next: NextFunction) =>
    SENTRY_PATH.test(req.path)
      ? publicCors(
          'POST, OPTIONS',
          'content-type, content-encoding, x-sentry-auth, authorization, sentry-trace, baggage',
        )(req, res, next)
      : next(),
  );
  app.enableCors({ origin: env.WEB_URL, credentials: true });
  app.enableShutdownHooks();
}
