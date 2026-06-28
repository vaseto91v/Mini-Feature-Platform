import { App } from "aws-cdk-lib";
import { MfpStack } from "../lib/mfp-stack";

const app = new App();

new MfpStack(app, "MfpStack", {
  // Resolves from the ambient AWS CLI profile at deploy time; agnostic at synth.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description:
    "Mini Feature Platform - Fargate API + ALB, RDS PostgreSQL, S3 + CloudFront SPA",
  // Optional strict-CORS origin for direct ALB access. Through CloudFront the API
  // is same-origin with the SPA, so this is not load-bearing (see lib/mfp-stack.ts).
  corsOrigin: app.node.tryGetContext("corsOrigin"),
});
