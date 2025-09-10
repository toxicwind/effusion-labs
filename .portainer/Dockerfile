# syntax=docker/dockerfile:1.7

############################
# deps layer (heavy caching)
############################
FROM node:24-alpine AS deps
WORKDIR /app

# Install build tools needed for native modules like ripgrep-bin
RUN apk add --no-cache build-base

# Reduce npm noise & avoid audits during CI
ENV npm_config_fund=false \
    npm_config_audit=false

# Cache node modules efficiently across builds
# Ensure patches are available before install so postinstall can apply them
COPY package*.json ./
COPY patches/ ./patches/
RUN --mount=type=cache,target=/root/.npm \
    npm ci

############################
# build layer
############################
FROM node:24-alpine AS builder
WORKDIR /app

ARG COMMIT_SHA=unknown
ENV COMMIT_SHA=${COMMIT_SHA}
ENV NODE_ENV=production

# Reuse cached node_modules from deps layer
COPY --from=deps /app/node_modules /app/node_modules
COPY package*.json ./
COPY . .

# Verify patches and then Eleventy build; cache Eleventy/Tailwind intermediates if any
RUN --mount=type=cache,target=/app/.cache \
    node utils/scripts/validation/verify-patch-applied.mjs && \
    echo "⚙️ Building site with Eleventy..." && \
    npx @11ty/eleventy

############################
# runtime (tiny, static)
############################
FROM nginx:stable-alpine

COPY --from=builder /app/_site/ /usr/share/nginx/html/
COPY .portainer/nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
