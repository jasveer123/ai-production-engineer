import { sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { users } from '../db/schema';

/** The account with this email, compared case-insensitively. */
export async function findUserByEmail(db: Database, email: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`);
  return row;
}
