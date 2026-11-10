import { existsSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { PASSWORD_MAX, PASSWORD_MIN } from '@ape/api-contracts';
import { and, eq } from 'drizzle-orm';
import { hashPassword } from '../../modules/auth/domain/password';
import { createDatabase } from './client';
import { users, workspaceMembers, workspaces } from './schema';

if (existsSync('.env')) process.loadEnvFile('.env');

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}`);
  return value;
};

async function main() {
  const email = required('CREATE_USER_EMAIL').toLowerCase();
  const password = required('CREATE_USER_PASSWORD');
  const name = process.env.CREATE_USER_NAME?.trim() || null;
  const workspaceName = process.env.CREATE_WORKSPACE_NAME?.trim() || 'My workspace';
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new Error(`Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`);
  }

  const { db, pool } = createDatabase(process.env.DATABASE_URL ?? '');
  const passwordHash = await hashPassword(password);
  try {
    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email,
          name,
          identityProvider: 'password',
          identityProviderId: email,
          passwordHash,
          emailVerifiedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [users.identityProvider, users.identityProviderId],
          set: { passwordHash, emailVerifiedAt: new Date() },
        })
        .returning();
      if (!user) throw new Error('Could not create the user');

      const [member] = await tx
        .select({ id: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.userId, user.id), eq(workspaceMembers.role, 'owner')));
      if (!member) {
        const [workspace] = await tx.insert(workspaces).values({ name: workspaceName }).returning();
        if (!workspace) throw new Error('Could not create the workspace');
        await tx
          .insert(workspaceMembers)
          .values({ workspaceId: workspace.id, userId: user.id, role: 'owner' });
      }
    });
    new Logger('create-user').log(`Ready: ${email} can sign in with the password you set`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  new Logger('create-user').error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
