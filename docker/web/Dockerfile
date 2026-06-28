# syntax=docker/dockerfile:1
#
# Web image (Nuxt SPA). Built from the REPO ROOT so the @mfp/shared workspace
# (consumed as TS source) resolves. `ssr: false` still produces a small Nitro
# node server whose job is to serve the static SPA shell with a catch-all
# fallback, so deep links like /projects/<id> resolve client-side. In AWS this
# role is played by S3 + CloudFront; locally the node server keeps it one image.

# ---- build ----
FROM node:22-slim AS build
WORKDIR /repo

# Full source (host node_modules/.nuxt/.output are excluded via .dockerignore).
# A complete install WITH lifecycle scripts runs `nuxt prepare` and resolves
# esbuild's platform binary - both needed for a clean build.
COPY . .
RUN npm ci
RUN npm run build --workspace @mfp/web

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
# Only the self-contained server output is needed at runtime.
COPY --from=build /repo/apps/web/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
