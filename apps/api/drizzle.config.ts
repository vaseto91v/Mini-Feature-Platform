import { defineConfig } from "drizzle-kit";

// Migrations run as the admin/owner role (DATABASE_ADMIN_URL); the app process
// connects as the restricted `app` role (DATABASE_URL) so RLS is enforced.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_ADMIN_URL ??
      process.env.DATABASE_URL ??
      "postgres://mfp:mfp_dev_password@localhost:5432/mfp",
  },
});
