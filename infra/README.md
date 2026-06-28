# Infrastructure (AWS CDK)

Provisions the cloud topology from [docs/ARCHITECTURE.md §6](../docs/ARCHITECTURE.md) as a
single CDK stack (`MfpStack`):

```
Browser ─► CloudFront ─┬─ default ──► S3            (static Nuxt SPA)
                       └─ /api/*  ──► ALB ─► Fargate (Fastify API) ─► RDS PostgreSQL
```

- **API** - ECS **Fargate** behind an **ALB** (`ApplicationLoadBalancedFargateService`),
  running the **same Docker image** `docker compose` builds. Containers (not Lambda) because
  the synchronous API needs a warm DB pool and holds long-lived **SSE** connections.
- **Data** - **RDS PostgreSQL 16**, private subnets, reachable only from the API's security
  group. Credentials live in **Secrets Manager**.
- **SPA** - built static and served from **S3 via CloudFront**.

### One domain, two origins

CloudFront serves the SPA at `/` and reverse-proxies `/api/*` to the ALB. That makes the API
**same-origin** with the SPA, which is what lets the static build ship with an *empty* API base
(`NUXT_PUBLIC_API_BASE=`, so calls go to a relative `/api`) - no ALB URL to bake in at build
time, no CORS, and the httpOnly refresh cookie just works. The `/api/*` behavior disables
caching and forwards all headers/cookies/query (so `Authorization` and the SSE `?token=` pass
through).

### The two database roles (RLS)

Defense-in-depth tenancy needs a **restricted** runtime role (`app`, `NOSUPERUSER NOBYPASSRLS`)
distinct from the **admin** role that owns the schema and RLS policies. Locally
`docker/postgres/init` creates `app`; RDS has no init hook, so the API container's boot step
(`migrate.ts`) creates it idempotently from the admin connection when `APP_DB_*` are set, then
runs migrations, then serves as `app`.

## Prerequisites

- AWS account + credentials (`aws configure` / `AWS_PROFILE`), and a region.
- Docker running (CDK builds the API image locally to publish to ECR).
- One-time per account/region: `npm run cdk:bootstrap`.

## Deploy / destroy

From the **repo root**:

```bash
npm install                 # once (pulls the CDK toolkit)
npm run cdk:bootstrap       # once per account+region

npm run deploy              # builds the SPA (empty API base) + cdk deploy
# → outputs AppUrl=https://<id>.cloudfront.net  ← open this

npm run destroy             # tears the whole stack down
```

`npm run deploy` runs `build:web:cloud` first so CloudFront serves the real SPA; if you
`cdk deploy` directly without building, a placeholder page is published instead (and a warning
is printed). Strict CORS for direct ALB hits: `cdk deploy -c corsOrigin=https://<your-domain>`.

Verify (no deploy needed, no AWS account required):

```bash
npm run cdk:synth           # synthesizes the CloudFormation template
```

## Status & honest caveats

- **Synth-verified**, and written to match the running app's contract (image, env, the two DB
  roles, health check). **A live end-to-end AWS deploy has not been run here** - that spends
  real money on the owner's account, so it's left as the documented `npm run deploy` path.
- Cost/teardown posture is tuned for an assessment: single-AZ `t3.micro` RDS, one NAT gateway,
  `desiredCount: 1`, and `RemovalPolicy.DESTROY` everywhere so `npm run destroy` leaves nothing
  behind. Production would flip on Multi-AZ, deletion protection, backups, and ≥2 tasks.
- `desiredCount: 1` keeps migrate-on-boot single-writer. Scaling out would move migrations to a
  one-off task (or advisory lock) so concurrent tasks don't race.
- CloudFront streams SSE through the `/api/*` behavior; at high fan-out a dedicated realtime
  tier is the documented next step (ARCHITECTURE.md §7).
