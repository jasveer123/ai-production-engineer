import { sql } from 'drizzle-orm';
import type { Database } from '../../../core/db/client';
import { users } from '../../../core/db/schema';

export async function findUserByEmail(db: Database, email: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`);
  return row;
}
