# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Pass commit from CI; build works even without .git folder
ARG COMMIT_SHA=unknown
ENV COMMIT_SHA=${COMMIT_SHA}
ENV NODE_ENV=production

# Needed only if you want git fallback locally; harmless otherwise
RUN apk add --no-cache git

WORKDIR /app

# Install deps first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev=false

# Copy source
COPY . .

# Build static site (Eleventy)
RUN echo "⚙️ Building site with Eleventy..." \
 && npx @11ty/eleventy

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM nginx:stable-alpine

# Static site only
COPY --from=builder /app/_site/ /usr/share/nginx/html/
COPY .portainer/nginx.conf /etc/nginx/conf.d/default.conf
