# syntax=docker/dockerfile:1
#
# API image (Fastify + TypeScript). Run from the REPO ROOT as build context so
# the npm workspace (`packages/shared`, which the API consumes as TS source) is
# available. Deps are installed inside the image so the native @node-rs/argon2
# binary matches the Linux runtime (a host bind-mount from Windows would not).
#
# We execute the TypeScript entrypoints directly with tsx - no separate compile
# step - which keeps the local-run image simple and the source mappings honest.
# (A production image would tsup-bundle and slim the runtime stage; for the
# docker-compose run path, reliability beats image size.)

FROM node:22-slim

WORKDIR /repo

# Install workspace deps from the lockfile. --ignore-scripts skips the web
# workspace's `nuxt prepare` postinstall (its source isn't in this image);
# @node-rs/argon2 needs no build step - its Linux binary ships as a platform
# optionalDependency that npm resolves automatically.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY infra/package.json infra/
RUN npm ci --ignore-scripts

# Application source (only what the API needs to run).
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

# Set production AFTER install so devDependencies (tsx) are present.
ENV NODE_ENV=production
WORKDIR /repo/apps/api
EXPOSE 3000

# Apply migrations (idempotent - Drizzle tracks applied files) then start.
CMD ["sh", "-c", "node --import tsx src/db/migrate.ts && node --import tsx src/index.ts"]
