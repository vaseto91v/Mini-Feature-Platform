# Mini Feature Platform

A multi-tenant platform for managing **Projects** and **Tasks**, with a Jira/Linear-style
Kanban board, real-time updates, full authentication, and an event-driven backbone - built
to run identically on a laptop (`docker compose`) and on AWS.

This is the assessment's three parts:

- **Part 1 - Backend:** Node + TypeScript API (Fastify), PostgreSQL, clean layering.
- **Part 2 - Frontend:** Vue (Nuxt) SPA, component structure, clear state management.
- **Part 3 - Architecture & reasoning:** see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Quick start (one command)

**Prerequisite:** Docker Desktop. Nothing else - no Node, no manual env setup.

```bash
docker compose up --build       # or: npm run up
```

Then open **http://localhost:3001** and **create an organization** (this registers you as its owner).

| Service  | URL                     |
|----------|-------------------------|
| Web (SPA)| http://localhost:3001   |
| API      | http://localhost:3000   |
| Postgres | localhost:5432          |

The API container waits for Postgres to be healthy, runs migrations automatically, then
serves; the web container waits for the API. Tear down with `docker compose down` (add `-v`
to also drop the database volume).

> Sensible dev defaults (DB credentials, JWT secrets) are baked into `docker-compose.yml`,
> so the command above works with zero configuration. Use real secrets outside local dev.

---

## What's included

- **Multi-tenancy** - one organization per tenant; **pooled** model (shared DB + `tenant_id`)
  hardened with **PostgreSQL Row-Level Security** as defense-in-depth.
- **Auth** - JWT access token (in memory) + rotating refresh token (httpOnly cookie),
  argon2 password hashing, roles on the user model.
- **Projects & Tasks** - create/list/delete projects, create/list/update/delete tasks.
- **Kanban board** - drag to change status with **optimistic update + rollback** on failure;
  click a card for a **task detail** modal; delete with a 5-second **Undo**.
- **Cross-cutting views** - "My issues" (every task across projects) and "Account"
  (profile + organization).
- **Real-time** - live board sync over **Server-Sent Events**, and a per-project **activity
  timeline** fed by a **transactional outbox**.
- **Shared contract** - Zod schemas in `packages/shared` are the single source of truth:
  the API validates requests against them and the web validates forms against the *same*
  schemas, with TypeScript types inferred from them.
- **Light & dark themes.**
- **Tests** - Vitest unit (services) + integration (API), runnable with no database.

---

## Tech stack

| Layer        | Choice |
|--------------|--------|
| Monorepo     | npm workspaces - `packages/shared`, `apps/api`, `apps/web`, `infra` |
| Shared       | Zod schemas + inferred TS types (single source of truth, FE + BE) |
| Backend      | Fastify + TypeScript, layered (routes → services → repositories) |
| Data access  | Drizzle ORM, PostgreSQL + Row-Level Security |
| Auth         | JWT access + refresh rotation, argon2, roles |
| Frontend     | Nuxt 3 (Vue) SPA + Pinia + Tailwind CSS + `vuedraggable` |
| Events       | Transactional outbox → in-process bus (an EventBridge/SQS-ready seam) |
| Realtime     | Server-Sent Events |
| Tests        | Vitest |
| Infra        | AWS CDK → Fargate + ALB, RDS, S3 + CloudFront (synth-verified) |

---

## Running the tests

```bash
npm install      # once
npm test         # all workspaces (currently the API suite)
```

The suite runs against an **in-memory unit of work** - no database or running services
required, so it works on a clean clone or in CI. It covers the services (multi-tenant
isolation, the transactional-outbox events, refresh-token rotation, delete cascade) and the
HTTP API end-to-end via Fastify's `inject` (auth guard, validation, the full project/task
lifecycle, tenant isolation across the boundary, and the outbox → activity-feed flow).

---

## Local development without Docker

Useful for fast iteration with hot reload. Requires **Node 22** (see `.nvmrc`) and a Postgres
(the compose file can provide just the DB).

```bash
npm install
cp .env.example .env            # API loads this in non-production

npm run db:up                   # start only Postgres in Docker
npm run db:migrate              # apply migrations

npm run dev:api                 # Fastify on :3000 (tsx watch)
npm run dev:web                 # Nuxt on :3001
```

### Useful scripts (root)

| Script | Description |
|--------|-------------|
| `npm run up` / `npm run down` | full stack up (build) / down |
| `npm run logs` | tail all container logs |
| `npm run db:up` / `npm run db:migrate` | Postgres only / run migrations |
| `npm run dev:api` / `npm run dev:web` | run a single app in watch mode |
| `npm run typecheck` | typecheck every workspace |
| `npm test` | run the test suites |
| `npm run cdk:synth` / `npm run cdk:diff` | synthesize / diff the AWS CDK stack |
| `npm run deploy` / `npm run destroy` | build SPA + deploy to AWS / tear it down |

---

## Project structure

```
packages/shared   Zod schemas + inferred types (the API contract, shared FE/BE)
apps/api          Fastify API - routes → services → repositories, auth, events
  src/repositories  Postgres + in-memory implementations behind one interface
  src/events        transactional outbox → dispatcher → bus → consumers (activity, SSE)
  test              Vitest unit + integration suites
apps/web          Nuxt SPA - pages, components, Pinia stores, Tailwind
infra             AWS CDK app - Fargate+ALB, RDS, S3+CloudFront (see infra/README.md)
docker            Postgres init (creates the restricted RLS app role)
docs              ARCHITECTURE.md (Part 3)
```

---

## Deployment to AWS

An **AWS CDK** stack in [infra/](infra/) provisions **ECS Fargate + ALB** (API),
**RDS PostgreSQL** (data), and **S3 + CloudFront** (the static Nuxt build) - with CloudFront
proxying `/api/*` to the ALB so the SPA and API share one origin. The reasoning - why
containers for the synchronous API (connection pooling + long-lived SSE) with Lambda as the
home for async event consumers, why a static SPA over SSR - is in
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

```bash
npm run cdk:bootstrap     # once per AWS account + region
npm run deploy            # builds the SPA + cdk deploy → prints the CloudFront URL
npm run destroy           # tears the whole stack down
```

> Status: `docker compose up` is the supported, verified local path. The CDK stack is
> **synth-verified** and matches the running app's contract; a live end-to-end AWS deploy is
> billable and left to the account owner. Details and caveats: **[infra/README.md](infra/README.md)**.

---

## Architecture & reasoning (Part 3)

The full write-up - multi-tenancy model and trade-offs, the transactional-outbox event flow,
serverless-vs-containers, SSR-vs-static, and how it scales - lives in
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.
