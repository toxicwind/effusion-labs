# syntax=docker/dockerfile:1.7

############################
# deps layer (heavy caching)
############################
FROM node:24-bookworm AS deps
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential python3 ca-certificates chromium git && \
    rm -rf /var/lib/apt/lists/*

ENV npm_config_fund=false \
    npm_config_audit=false \
    npm_config_proxy= \
    npm_config_https_proxy= \
    npm_config_http_proxy= \
    http_proxy= \
    https_proxy= \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
COPY patches/ ./patches/
# postinstall needs the patch runner available during dependency install
COPY tools/apply-patches.mjs ./tools/apply-patches.mjs
RUN npm ci --no-audit --no-fund

############################
# build layer (production)
############################
FROM node:24-bookworm AS builder
WORKDIR /app

ARG COMMIT_SHA=unknown
ENV COMMIT_SHA=${COMMIT_SHA}

ENV NODE_ENV=production \
    ELEVENTY_ENV=production \
    npm_config_proxy= \
    npm_config_https_proxy= \
    npm_config_http_proxy= \
    http_proxy= \
    https_proxy= \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY --from=deps /usr/bin/chromium /usr/bin/chromium
COPY --from=deps /app/node_modules /app/node_modules
COPY package*.json ./
COPY tools ./tools
COPY bin ./bin
COPY . .

RUN node tools/check-chromium.mjs && \
    npm run tools:check-patches && \
    npm run build

############################
# runtime (tiny, static)
############################
FROM nginx:1.29-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/_site/ /usr/share/nginx/html/
COPY .portainer/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl --fail --silent --show-error http://127.0.0.1/ >/dev/null 2>&1 || exit 1
