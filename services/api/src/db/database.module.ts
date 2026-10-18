import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { ENV, type ApiEnv } from '../config/config.module';
import { createDatabase, type Database } from './client';

export const DB = Symbol('DB');
const POOL = Symbol('POOL');

@Global()
@Module({
  providers: [
    {
      provide: POOL,
      inject: [ENV],
      useFactory: (env: ApiEnv) => createDatabase(env.DATABASE_URL),
    },
    { provide: DB, inject: [POOL], useFactory: (c: { db: Database }) => c.db },
  ],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly conn: { pool: Pool }) {}

  async onApplicationShutdown() {
    await this.conn.pool.end();
  }
}
