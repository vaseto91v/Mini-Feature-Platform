import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

// Characters that would break a postgres:// URL if they appeared in a password.
const URL_UNSAFE = " %+/:?#@[]{}\"'\\`<>|^~";

export interface MfpStackProps extends StackProps {
  /** Strict CORS origin for direct ALB access (optional; same-origin via CloudFront). */
  readonly corsOrigin?: string;
}

/**
 * The whole platform as one stack:
 *
 *   Browser ─► CloudFront ─┬─ default ────► S3 (static Nuxt SPA)
 *                          └─ /api/*  ────► ALB ─► Fargate (Fastify API) ─► RDS
 *
 * Routing /api through the same CloudFront domain makes the API *same-origin*
 * with the SPA: the SPA ships with an empty API base (relative `/api`), so there
 * is no build-time URL to bake in, CORS is a non-issue, and the refresh cookie
 * flows normally. Lambda is intentionally absent - the synchronous API needs a
 * warm connection pool and long-lived SSE connections a container holds and a
 * function cannot (see docs/ARCHITECTURE.md §6).
 */
export class MfpStack extends Stack {
  constructor(scope: Construct, id: string, props: MfpStackProps = {}) {
    super(scope, id, props);

    const DB_NAME = "mfp";
    const ADMIN_USER = "mfp_admin";
    const APP_USER = "app"; // must match the role name granted in drizzle/0001_rls.sql

    // --- Network -----------------------------------------------------------
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1, // one NAT keeps cost down; tasks reach ECR + Secrets Manager through it
    });

    // --- Secrets -----------------------------------------------------------
    // RDS master credentials (admin role - runs migrations, owns RLS policies).
    const dbCredentials = rds.Credentials.fromGeneratedSecret(ADMIN_USER, {
      excludeCharacters: URL_UNSAFE,
    });

    // Password for the restricted runtime role (NOSUPERUSER / NOBYPASSRLS) the API
    // connects as, so Row-Level Security actually applies to it.
    const appDbSecret = new secretsmanager.Secret(this, "AppDbSecret", {
      description: "Password for the restricted RLS application role",
      generateSecretString: { passwordLength: 24, excludePunctuation: true },
    });

    const jwtAccessSecret = new secretsmanager.Secret(this, "JwtAccessSecret", {
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });
    const jwtRefreshSecret = new secretsmanager.Secret(this, "JwtRefreshSecret", {
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });
    for (const s of [appDbSecret, jwtAccessSecret, jwtRefreshSecret]) {
      s.applyRemovalPolicy(RemovalPolicy.DESTROY); // assessment: clean teardown
    }

    // --- Database ----------------------------------------------------------
    const db = new rds.DatabaseInstance(this, "Db", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO,
      ),
      credentials: dbCredentials,
      databaseName: DB_NAME,
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      storageEncrypted: true,
      multiAz: false,
      // Assessment posture: easy, complete teardown. Production would protect this.
      removalPolicy: RemovalPolicy.DESTROY,
      deleteAutomatedBackups: true,
      deletionProtection: false,
    });

    // --- API (Fargate behind an ALB) --------------------------------------
    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    const apiImage = ecs.ContainerImage.fromAsset(repoRoot, {
      file: "docker/api/Dockerfile", // the same image docker-compose builds
    });

    // Boot script: assemble the two connection URLs from injected secret parts,
    // create-or-update the restricted role + apply migrations, then serve. The
    // app role is bootstrapped by migrate.ts when APP_DB_* are present (it stands
    // in for the local docker/postgres/init role-creation script).
    const boot = [
      "set -e",
      'export DATABASE_ADMIN_URL="postgres://$DB_ADMIN_USER:$DB_ADMIN_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"',
      'export DATABASE_URL="postgres://$APP_DB_USER:$APP_DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"',
      "node --import tsx src/db/migrate.ts",
      "node --import tsx src/index.ts",
    ].join("\n");

    const api = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Api", {
      cluster,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 1, // single task ⇒ no migrate-on-boot race; scale-out is an ECS knob
      minHealthyPercent: 100, // keep the old task until the new one is healthy
      maxHealthyPercent: 200,
      publicLoadBalancer: true,
      circuitBreaker: { rollback: true },
      healthCheckGracePeriod: Duration.seconds(120), // migrations run before listen
      taskImageOptions: {
        image: apiImage,
        containerPort: 3000,
        command: ["sh", "-c", boot],
        enableLogging: true,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: "api",
          logRetention: logs.RetentionDays.ONE_WEEK,
        }),
        environment: {
          NODE_ENV: "production",
          PORT: "3000",
          ACCESS_TOKEN_TTL: "15m",
          REFRESH_TOKEN_TTL: "7d",
          // Same-origin via CloudFront ⇒ CORS is not exercised by the SPA. Defaults
          // to localhost for direct ALB testing; override with `-c corsOrigin=...`.
          CORS_ORIGIN: props.corsOrigin ?? "http://localhost:3001",
          DB_HOST: db.dbInstanceEndpointAddress,
          DB_PORT: db.dbInstanceEndpointPort,
          DB_NAME,
          DB_ADMIN_USER: ADMIN_USER,
          APP_DB_USER: APP_USER,
        },
        secrets: {
          DB_ADMIN_PASSWORD: ecs.Secret.fromSecretsManager(db.secret!, "password"),
          APP_DB_PASSWORD: ecs.Secret.fromSecretsManager(appDbSecret),
          JWT_ACCESS_SECRET: ecs.Secret.fromSecretsManager(jwtAccessSecret),
          JWT_REFRESH_SECRET: ecs.Secret.fromSecretsManager(jwtRefreshSecret),
        },
      },
    });

    api.targetGroup.configureHealthCheck({
      path: "/health",
      healthyHttpCodes: "200",
    });

    // Let the API tasks reach Postgres.
    db.connections.allowDefaultPortFrom(api.service, "Fargate API → RDS");

    // --- Static SPA (S3 + CloudFront) -------------------------------------
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // served only via CloudFront OAC
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Client-side routing: rewrite extension-less paths (e.g. /projects/abc) to the
    // SPA shell. Scoped to the default behavior only, so it never touches /api/*.
    const spaRouter = new cloudfront.Function(this, "SpaRouter", {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var req = event.request;
  var uri = req.uri;
  if (uri === '/' || uri.endsWith('/')) { req.uri = '/index.html'; return req; }
  var last = uri.split('/').pop();
  if (last.indexOf('.') === -1) { req.uri = '/index.html'; }
  return req;
}`),
    });

    const distribution = new cloudfront.Distribution(this, "Cdn", {
      comment: "Mini Feature Platform",
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          {
            function: spaRouter,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        // Reverse-proxy the API. CACHING_DISABLED + ALL_VIEWER forwards auth headers,
        // cookies, query (?token= for SSE) and never caches dynamic responses.
        "/api/*": {
          origin: new origins.LoadBalancerV2Origin(api.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            readTimeout: Duration.seconds(60), // headroom for SSE
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
    });

    // Upload the built SPA. Prefer the real Nuxt output; fall back to a placeholder
    // so `cdk synth` works on a clean checkout (run `npm run build:web:cloud` first
    // for a real deploy - see infra/README.md).
    const builtSpa = path.join(repoRoot, "apps", "web", ".output", "public");
    const spaSource = existsSync(builtSpa)
      ? builtSpa
      : path.join(here, "..", "assets", "web-placeholder");
    if (spaSource !== builtSpa) {
      console.warn(
        "[infra] apps/web/.output/public not found - deploying a placeholder SPA.\n" +
          "        Run `npm run build:web:cloud` before deploying the real site.",
      );
    }

    new s3deploy.BucketDeployment(this, "DeploySpa", {
      sources: [s3deploy.Source.asset(spaSource)],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // --- Outputs -----------------------------------------------------------
    new CfnOutput(this, "AppUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "Open this - the SPA, with /api proxied to the Fargate service",
    });
    new CfnOutput(this, "ApiAlbUrl", {
      value: `http://${api.loadBalancer.loadBalancerDnsName}`,
      description: "Direct ALB origin (health check: /health)",
    });
    new CfnOutput(this, "DbEndpoint", { value: db.dbInstanceEndpointAddress });
  }
}
