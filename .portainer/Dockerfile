# syntax=docker/dockerfile:1.7

############################
# deps layer (heavy caching)
############################
FROM node:24-alpine AS deps
WORKDIR /app

RUN apk add --no-cache build-base python3 libc6-compat

# Keep install in "dev" mode so devDependencies are present for the build
ENV npm_config_fund=false \
    npm_config_audit=false

COPY package*.json ./
COPY patches/ ./patches/
RUN --mount=type=cache,target=/root/.npm \
    npm ci

############################
# build layer (production)
############################
FROM node:24-alpine AS builder
WORKDIR /app

ARG COMMIT_SHA=unknown
ENV COMMIT_SHA=${COMMIT_SHA}

# Production signals for the toolchain
ENV NODE_ENV=production \
    ELEVENTY_ENV=production

COPY --from=deps /app/node_modules /app/node_modules
COPY package*.json ./
COPY . .

RUN --mount=type=cache,target=/app/.cache \
    --mount=type=cache,target=/root/.cache \
    npm run verify:patches && \
    npm run build

############################
# runtime (tiny, static)
############################
FROM nginx:stable-alpine
COPY --from=builder /app/_site/ /usr/share/nginx/html/
COPY .portainer/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
