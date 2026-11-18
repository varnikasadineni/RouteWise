import { Pool } from "pg";
const globalForPg = globalThis as unknown as { pgPool?: Pool };
export const pgPool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pgPool;

import type { PoolClient } from "pg";
// Runs fn inside a transaction that tells PostgreSQL which app user is acting.
// The audit trigger reads this with current_setting('routewise.user_id', true).
export async function withAppUser<T>(userId: number, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('routewise.user_id', $1, true)", [String(userId)]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
