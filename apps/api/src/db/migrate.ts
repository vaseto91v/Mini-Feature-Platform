import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../config/env";

// Migrations run as the admin/owner role so they can create roles, grants and
// RLS policies. Falls back to DATABASE_URL if no admin URL is configured.
const url = env.DATABASE_ADMIN_URL ?? env.DATABASE_URL;

/**
 * Ensure the restricted runtime role exists before migrations grant it table
 * access. Locally this is done once by docker/postgres/init/01-create-app-role.sh;
 * managed Postgres (RDS) has no init hook, so when APP_DB_* are provided we create
 * the role here from the admin connection. NOSUPERUSER/NOBYPASSRLS so RLS applies.
 * Idempotent - safe to run on every boot.
 */
async function ensureAppRole(adminUrl: string): Promise<void> {
  const appUser = process.env.APP_DB_USER;
  const appPassword = process.env.APP_DB_PASSWORD;
  if (!appUser || !appPassword) return; // local compose path: init script owns this

  const ident = `"${appUser.replace(/"/g, '""')}"`;
  const literal = `'${appPassword.replace(/'/g, "''")}'`;
  const client = postgres(adminUrl, { max: 1 });
  try {
    await client.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${appUser.replace(/'/g, "''")}') THEN
          CREATE ROLE ${ident} LOGIN PASSWORD ${literal}
            NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        ELSE
          ALTER ROLE ${ident} LOGIN PASSWORD ${literal};
        END IF;
      END $$;
    `);
    console.log(`Ensured restricted application role "${appUser}".`);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  await ensureAppRole(url);
  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
