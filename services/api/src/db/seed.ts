/**
 * Idempotent seed: a demo workspace with an owner, an engineer, a viewer and one service.
 * Run with `pnpm db:seed`. Users sign in with these emails and SEED_PASSWORD
 * (default `demo-shop-2026`), or through the local-only dev login.
 */
import { existsSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import { hashPassword } from '../auth/password';
import { createDatabase } from './client';
import { services, users, workspaceMembers, workspaces, type Role } from './schema';

if (existsSync('.env')) process.loadEnvFile('.env');

const DEMO_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_USERS: { email: string; name: string; role: Role }[] = [
  { email: 'owner@demo.local', name: 'Demo Owner', role: 'owner' },
  { email: 'engineer@demo.local', name: 'Demo Engineer', role: 'engineer' },
  { email: 'viewer@demo.local', name: 'Demo Viewer', role: 'viewer' },
];

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'demo-shop-2026';

async function main() {
  const { db, pool } = createDatabase(process.env.DATABASE_URL ?? '');
  const passwordHash = await hashPassword(SEED_PASSWORD);
  try {
    await db
      .insert(workspaces)
      .values({ id: DEMO_WORKSPACE_ID, name: 'Demo Shop' })
      .onConflictDoNothing();

    for (const u of DEMO_USERS) {
      const [user] = await db
        .insert(users)
        .values({
          email: u.email,
          name: u.name,
          identityProvider: 'dev',
          identityProviderId: u.email,
          passwordHash,
          emailVerifiedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [users.identityProvider, users.identityProviderId],
          set: { name: u.name, passwordHash, emailVerifiedAt: new Date() },
        })
        .returning();
      if (!user) throw new Error(`failed to upsert ${u.email}`);
      await db
        .insert(workspaceMembers)
        .values({ workspaceId: DEMO_WORKSPACE_ID, userId: user.id, role: u.role })
        .onConflictDoNothing();
    }

    const existing = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.workspaceId, DEMO_WORKSPACE_ID), eq(services.name, 'demo-shop-api')));
    if (existing.length === 0) {
      await db.insert(services).values({
        workspaceId: DEMO_WORKSPACE_ID,
        name: 'demo-shop-api',
        environment: 'production',
        repositoryFullName: 'your-github-user/demo-shop',
      });
    }
    console.log('Seeded demo workspace with users:', DEMO_USERS.map((u) => u.email).join(', '));
    console.log(`Password for all demo users: ${SEED_PASSWORD}`);
  } finally {
    await pool.end();
  }
}

void main();
