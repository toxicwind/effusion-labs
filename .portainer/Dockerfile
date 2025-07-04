# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Log: node version and env context
RUN node -v && npm -v && echo "🐳 STARTING ELEVENTY BUILD CONTEXT"

# Install deps
COPY package*.json ./
RUN npm ci

# Copy project files
COPY . .

# Show incoming directory structure
RUN echo "📁 Initial file tree:" && find . -type f

# Run Eleventy build (with Tailwind plugin)
RUN echo "⚙️ Building site with Eleventy..." \
 && npx @11ty/eleventy

# Log final structure of _site
RUN echo "📁 _site structure:" && find _site -type f

# Check if main.css exists, preview contents
RUN echo "🔍 Inspecting _site/assets/main.css" \
 && if [ -f /app/_site/assets/main.css ]; then \
      ls -lh /app/_site/assets/main.css && \
      head -c 500 /app/_site/assets/main.css | strings || true; \
    else \
      echo "⚠️ WARNING: main.css NOT FOUND!"; \
    fi

# Optional: List logo presence
RUN echo "🖼️ Checking logo.png..." \
 && if [ -f /app/_site/assets/logo.png ]; then \
      ls -lh /app/_site/assets/logo.png; \
    else \
      echo "⚠️ WARNING: logo.png not found."; \
    fi

# ─── Runtime stage ─────────────────────────────────────────────────────────────
FROM nginx:stable-alpine

COPY --from=builder /app/_site/ /usr/share/nginx/html/
COPY .portainer/nginx.conf /etc/nginx/conf.d/default.conf
