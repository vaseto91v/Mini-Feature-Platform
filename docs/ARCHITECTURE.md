# Architecture & Reasoning

> **Part 3 of the assessment.** The one-page **Summary** below is the distilled answer;
> the numbered sections after it are the full reasoning - for every significant choice, the
> alternatives considered and the trade-off made.

## Summary (the one-page version)

A multi-tenant "Mini Feature Platform" (Projects + Tasks) that runs identically on a laptop
(`docker compose`) and on AWS. It is **layered, type-safe end to end, and event-driven**.

- **Monorepo + shared contract.** npm workspaces with a `packages/shared` package of **Zod
  schemas**. The API validates requests against them; the web validates forms against the
  *same* schemas; TS types are inferred from them. The front/back contract cannot drift.
- **Layered backend (Fastify):** `routes → services → repositories`. Repositories sit behind
  an interface with **two implementations** (Postgres and in-memory) - the in-memory one
  makes the whole stack testable without a database.
- **Multi-tenancy = the core "support multiple clients" requirement.** Chose the **pooled**
  model (shared DB + `tenant_id`) over silo (DB-per-tenant) or bridge (schema-per-tenant),
  and hardened it with **defense-in-depth**: the app layer auto-scopes every query by the
  request's tenant, *and* PostgreSQL **Row-Level Security** enforces the same rule at the DB,
  so even a buggy query cannot leak across tenants. (A managed engine like Hasura drives the
  same RLS from JWT vars declaratively - we hand-rolled it to keep a graded Node/TS + REST
  backend.)
- **Auth:** short-lived JWT **access** token (in memory) + rotating **refresh** token
  (httpOnly cookie), argon2 hashing, roles on the user model.
- **Event-driven backbone:** a state change and its event are written in the **same
  transaction** (transactional **outbox**), so events are never lost or phantom-emitted. A
  relay republishes to an **in-process bus** - the same bus runs locally and on Fargate - and
  that bus is a deliberate **seam** where **EventBridge/SQS** drops in unchanged when consumers
  need to scale out. Consumers: a per-project **activity timeline** and **live board sync over SSE**.
- **Compute choice falls out of the design:** the synchronous API runs on **containers
  (Fargate + ALB)**, not Lambda - containers keep a warm DB connection pool and hold the
  **long-lived SSE connections Lambda can't**; Lambda is the natural home for the **async**
  event consumers when they're split out behind that seam (what it's genuinely best at). The
  frontend is a **static Nuxt SPA** (no SEO/public pages → SSR buys nothing) on S3 + CloudFront.

The rest of this document expands each of these.

## 1. Overview

A multi-tenant "Mini Feature Platform" for managing Projects and Tasks. A single
codebase runs identically on a developer laptop (`docker-compose`) and on AWS
(`cdk deploy`). The system is layered, type-safe end to end, and event-driven at its core.

```
                          ┌─────────────────────────────┐
        Browser  ───────► │  Nuxt SPA (static)          │
                          │  Pinia store · Kanban board │
                          └───────────┬─────────────────┘
                                      │ REST (+ SSE stream)
                                      ▼
        ┌─────────────────────────────────────────────────────┐
        │  Fastify API (container)                            │
        │  routes → services → repositories                   │
        │  auth + tenant-context middleware                   │
        └───────┬───────────────────────────┬─────────────────┘
                │ (same tx)                  │ subscribe
                ▼                            ▼
        ┌───────────────┐            ┌──────────────────┐
        │ PostgreSQL    │            │ Event bus        │
        │ + RLS         │            │ (in-proc / EB)   │
        │ outbox table  │──relay────►│  → activity log  │
        └───────────────┘            │  → SSE broadcast │
                                     └──────────────────┘
```

## 2. Architecture choices

### Monorepo with a shared schema package
npm workspaces: `packages/shared`, `apps/api`, `apps/web`, `infra`. The backend
validates requests with Zod schemas defined in `packages/shared`; the frontend imports
the **same** schemas for form validation, and TypeScript types are *inferred* from them.
The API contract therefore cannot drift between front and back end - a whole class of
integration bugs is eliminated at compile time.

*Trade-off:* slightly more build wiring than two separate repos, paid back immediately
by the shared contract. npm workspaces (not pnpm) keeps reviewer setup to zero extra tooling.

### Layered backend (Fastify)
`routes → services → repositories`. Routes handle HTTP + validation; services hold
business logic; repositories own data access behind an interface (Postgres + in-memory
implementations). Chose Fastify over NestJS so the separation of concerns is a
**deliberate design we own and can explain**, rather than a framework default - and over
Express for first-class TypeScript and performance.

### Type-safe data access (Drizzle)
Drizzle over Prisma specifically because our tenancy model needs explicit control over
per-request transactions and a raw `set_config()` / `SET LOCAL` for Row-Level Security, which
Prisma makes awkward. Drizzle is SQL-first and pairs cleanly with Zod.

## 3. Multi-tenancy - adapting for multiple clients

The brief's core framing: *"a core platform that supports multiple client-specific applications."*

Three classic models were considered:

| Model | Isolation | Cost / Ops | Verdict |
|-------|-----------|-----------|---------|
| **Silo** (DB per tenant)    | Strongest | Highest | Overkill here; best for strict compliance / noisy-neighbor isolation |
| **Pooled** (shared DB, `tenant_id`) | Lowest by default | Cheapest, simplest to scale | **Chosen**, hardened (below) |
| **Bridge** (schema per tenant) | Middle | Middle | More provisioning/migration complexity than needed |

**Chosen: pooled, with isolation enforced at two layers (defense-in-depth):**

1. **Application layer** - every entity carries `tenant_id`; the request's tenant is
   derived from its JWT and loaded into a request context; the repository auto-scopes
   every query. This is the primary correctness mechanism.
2. **Database layer** - PostgreSQL **Row-Level Security** policies enforce the same rule,
   so even a bug in the app layer cannot leak data across tenants. The current tenant is
   set per request via `set_config('app.current_tenant_id', ..., true)` (the function form of
   `SET LOCAL`) inside a transaction, which is connection-pool safe (auto-resets on commit).

*Alternative noted:* a managed engine like **Hasura** or **PostGraphile** drives the very
same RLS from JWT session variables declaratively. We hand-rolled it to keep a custom
Node/TS backend (what Part 1 grades) and a REST surface; Hasura would trade backend
control for less boilerplate. *(This directly answers "how to adapt for multiple clients.")*

## 4. Authentication

JWT **access token** (short-lived, held in memory on the client) + **refresh token**
(rotated, stored in an httpOnly cookie). Users belong to a tenant and carry a **role**
(owner / admin / member). A `requireRole` guard is implemented alongside `requireAuth`;
since registration today creates one owner per organization (single-user model), no endpoint
restricts by role yet - the guard is in place for when member management is added. Passwords
hashed with argon2.

*Why cookies for refresh:* httpOnly cookies aren't readable by JS, mitigating token theft
via XSS; the Nuxt setup nudges toward this and it's the more secure default.

## 5. Event-driven backbone

### Transactional outbox
When a task's status changes, the **same database transaction** that updates the row also
writes an event to an `outbox` table. This makes "state changed" and "event recorded"
atomic - an event is never lost on a crash, nor emitted for a change that rolled back.

A **relay** reads the outbox and publishes events to a bus. Today that bus is an
**in-process** pub/sub (the `EventBus` class), so the whole event system runs inside the API
process - identically under `docker-compose` and on Fargate, with no broker to operate. The
bus is a deliberate **seam**: swapping it for **EventBridge → SQS → Lambda** changes only the
transport; the outbox, relay, and consumers are untouched (see §10). The outbox is what makes
that swap safe - delivery stays guaranteed regardless of the bus behind it.

### Consumers (in scope)
- **Activity timeline** - writes each event to an `activity` table; the UI shows a live
  per-project feed ("Alice moved *Deploy API* → in_progress").
- **Live board sync (SSE)** - broadcasts events to connected clients so the board updates
  in real time across users.

### Why SSE (and why it reinforces the compute choice)
SSE needs a **long-lived connection**, which a container holds naturally but Lambda cannot.
This is a concrete reason the synchronous API runs on containers, not Lambda. Optimistic UI
and live events are reconciled by **event-origin dedupe** so a client never double-applies
its own change.

## 6. Infrastructure (AWS) - serverless vs containers

**Synchronous API → containers (ECS Fargate behind an ALB), not Lambda.** Reasoning:
- Lambda + relational Postgres suffers connection-pool exhaustion under concurrency
  (each instance opens its own connection) - needs RDS Proxy / Data API to mitigate.
- Cold starts add latency to a user-facing CRUD API.
- Containers hold a warm connection pool and long-lived SSE connections, and run the
  **same Docker image locally and in the cloud** - maximum portability.

**Async side-effects → Lambda (the documented evolution).** Fire-and-forget event consumers
are the pattern Lambda is genuinely best at - no caller waiting, scales to zero, pay per event.
The current stack keeps consumers in-process behind the bus seam (§5); moving them onto
EventBridge + Lambda is a transport swap, not a rewrite.

**Provisioning:** AWS **CDK** (TypeScript), implemented in [`infra/`](../infra) - an
`aws-ecs-patterns ApplicationLoadBalancedFargateService` for the API (the *same* Docker image
`docker compose` builds), **RDS PostgreSQL** for data, and **S3 + CloudFront** for the static
Nuxt build. CloudFront serves the SPA at `/` and reverse-proxies `/api/*` to the ALB, so the
SPA and API are **same-origin**: the static build ships with an empty API base (relative
`/api`) - no ALB URL to bake in at build time, and no CORS. The two database roles (admin for
migrations/RLS, a restricted `app` role at runtime) carry over: on RDS the API's boot step
creates the restricted role idempotently, standing in for the local `postgres/init` script.
Synth-verified; `npm run deploy` / `npm run destroy` drive it. *(A live AWS deploy is billable
and left to the account owner.)*

### Frontend hosting - SPA/static vs SSR
The frontend is shipped as a **static Nuxt SPA** (`ssr: false`) to S3 + CloudFront.
- *Why:* the app is authenticated and highly interactive (a board) with no public/SEO
  pages, so server rendering buys nothing - and static hosting is simpler and cheaper.
- *Alternative - SSR (Nuxt Nitro server):* needed when first-paint speed, SEO, or
  public content pages matter; it requires a running Node runtime (another container or
  edge/Lambda target) rather than static hosting. Best for marketing sites, blogs, and
  content-heavy or SEO-sensitive apps - not for an internal authed tool like this.

## 7. How we would scale

- **API:** stateless containers behind the ALB → scale horizontally; ECS service
  auto-scaling on CPU/RPS.
- **Database:** start single RDS instance → add read replicas for read-heavy load →
  consider Aurora; partition by `tenant_id` or move large tenants to the silo model.
- **Events:** swap the in-process bus for EventBridge/SQS so consumers scale independently
  and absorb spikes; the outbox guarantees delivery.
- **Realtime:** SSE scales with the API tier; at very high fan-out, move to a dedicated
  pub/sub (e.g. API Gateway WebSockets + a connections table, or a managed service).
- **Frontend:** static assets on CloudFront scale effectively for free.

## 8. Testing & quality

- The Vitest suite runs the **real app composition** (routes → services → repositories →
  event bus) wired to the **in-memory unit of work** - no database, so it runs on a clean
  clone or in CI in about a second.
- **Unit tests** cover the services: multi-tenant isolation (tenant B can neither read nor
  mutate tenant A's data), the transactional-outbox events (including *no* event on a no-op
  status move), refresh-token rotation, and the project→tasks delete cascade.
- **Integration tests** drive the HTTP API via Fastify's `inject`: the auth guard (401), Zod
  validation (400), the full create→move→delete lifecycle, tenant isolation across the HTTP
  boundary, and the outbox → dispatcher → activity-feed flow.
- The two repository implementations are kept **behavior-compatible on purpose**, and writing
  the tests proved the value of that seam: they surfaced a real aliasing bug where the
  in-memory `findById` returned a *live* reference that a later mutation changed - so the
  service's "only emit when the status actually changed" check silently broke under the
  in-memory repo (Postgres returns fresh row snapshots, so it was correct there). Fixed by
  returning snapshots; the in-memory repo is now a faithful Postgres double.

## 9. Trade-offs & simplifications

- Pooled tenancy (not silo) - accepts shared infrastructure for cost/simplicity, mitigated by RLS.
- In-process bus instead of a managed broker - keeps both local dev *and* the deployed MVP dependency-free; the seam swaps to EventBridge/SQS unchanged (same event contract).
- Static SPA instead of SSR - no SEO benefit needed.
- Kept the domain model small (Projects + Tasks) deliberately; depth is in tenancy, events, and infra.
- Single user (owner) per organization - registration provisions the tenant *and* its owner;
  team invites and role-restricted endpoints are out of scope (the `requireRole` guard is
  ready for them). Richer issue fields (epics, assignees, priority, tags, comments) were
  likewise left out - only screens backed by real endpoints were built.

## 10. Improvements with more time

- **Per-tenant outbound webhooks** - clients register a URL; status-change events fan out
  via a fire-and-forget Lambda. The natural next "platform" feature for the multi-client framing.
- Notifications (email/Slack), per-tenant analytics dashboard.
- Move events to EventBridge + SQS with DLQs; add idempotency keys on consumers.
- RDS Proxy, observability (OpenTelemetry), and per-tenant rate limiting.
- Optimistic-UI conflict resolution with version vectors for concurrent editors.
