import './env';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { apiEnvSchema, loadEnv } from '@ape/config';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { createDatabase } from '../src/db/client';

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ bodyParser: false });
  configureApp(app, loadEnv(apiEnvSchema));
  await app.init();
  return app;
}

/** Empties every table except the audit log, which is append-only (the trigger blocks DELETE). */
export async function resetDatabase(): Promise<void> {
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);
  await db.execute(sql`
    do $$ declare r record; begin
      for r in select tablename from pg_tables
        where schemaname = 'public' and tablename <> 'audit_events'
      loop execute format('truncate table %I cascade', r.tablename); end loop;
    end $$;`);
  await pool.end();
}

/** Logs in through the dev login and returns an agent that carries the session cookie. */
export async function loginAs(app: INestApplication<App>, email: string) {
  const agent = request.agent(app.getHttpServer());
  await agent.post('/auth/dev-login').send({ email }).expect(204);
  return agent;
}

export async function createWorkspace(agent: ReturnType<typeof request.agent>, name: string) {
  const res = await agent.post('/workspaces').send({ name }).expect(201);
  return res.body as { id: string };
}
