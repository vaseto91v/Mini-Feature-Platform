import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import * as schema from "./schema";

// Runtime connection uses the restricted `app` role, so RLS is enforced.
const queryClient = postgres(env.DATABASE_URL, { max: 10 });

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
/** A transaction-scoped executor (same query API as `db`). */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything that can run queries - the base db or a transaction. */
export type DbExecutor = Database | Tx;

/**
 * Runs `fn` inside a transaction with the tenant context set for RLS.
 *
 * `set_config(..., true)` is transaction-local, so a pooled connection can never
 * carry one tenant's id into another request. Every query inside `fn` is both
 * atomic and tenant-isolated at the database level.
 */
export function withTenant<T>(
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
    );
    return fn(tx);
  });
}

/**
 * Runs `fn` inside a transaction with no tenant context. Used by system flows
 * (auth, the outbox relay) that operate on non-RLS tables across tenants.
 */
export function withSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}

export async function closeDb(): Promise<void> {
  await queryClient.end();
}
