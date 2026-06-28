-- Grants + Row-Level Security.
-- Runs as the admin/owner role. Grants table access to the restricted `app`
-- role and enables tenant isolation on the domain tables.
--
-- Tenant isolation is enforced at TWO layers (defense-in-depth): the repository
-- always filters by tenant_id (app layer), AND these policies enforce it at the
-- database (so even a buggy query cannot leak across tenants). The current tenant
-- is provided per-request via `set_config('app.current_tenant_id', ..., true)`
-- inside a transaction; `true` (is_local) scopes it to that transaction so a
-- pooled connection never leaks one tenant's id into another request.
--
-- NOTE: the role name `app` must match APP_DB_USER (default "app").

-- Table grants for the runtime role.
GRANT USAGE ON SCHEMA public TO app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
--> statement-breakpoint

-- RLS is applied to the user-facing domain tables. Auth/infra tables
-- (tenants, users, refresh_tokens, outbox) are intentionally left without RLS:
-- they are accessed by system flows (login looks up users across tenants, the
-- outbox relay reads events across tenants) and are scoped in the app layer.
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "projects"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tasks"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "activities" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "activities"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
