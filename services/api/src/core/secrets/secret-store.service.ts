import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { secrets } from '../db/schema';

type Executor = Pick<Database, 'insert' | 'select' | 'delete'>;
const PREFIX = 'local:';

@Injectable()
export class SecretStore {
  private readonly key: Buffer;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) env: ApiEnv,
  ) {
    this.key = Buffer.from(env.SECRETS_ENCRYPTION_KEY, 'hex');
  }

  async put(workspaceId: string, value: string, ex: Executor = this.db): Promise<string> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const ciphertext = [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
    const [row] = await ex.insert(secrets).values({ workspaceId, ciphertext }).returning();
    return `${PREFIX}${row!.id}`;
  }

  async get(workspaceId: string, reference: string): Promise<string | undefined> {
    if (!reference.startsWith(PREFIX)) return undefined;
    const [row] = await this.db
      .select()
      .from(secrets)
      .where(
        and(eq(secrets.id, reference.slice(PREFIX.length)), eq(secrets.workspaceId, workspaceId)),
      );
    if (!row) return undefined;
    const [iv, tag, enc] = row.ciphertext.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv!);
    decipher.setAuthTag(tag!);
    return Buffer.concat([decipher.update(enc!), decipher.final()]).toString('utf8');
  }

  async delete(workspaceId: string, reference: string, ex: Executor = this.db): Promise<void> {
    if (!reference.startsWith(PREFIX)) return;
    await ex
      .delete(secrets)
      .where(
        and(eq(secrets.id, reference.slice(PREFIX.length)), eq(secrets.workspaceId, workspaceId)),
      );
  }
}
