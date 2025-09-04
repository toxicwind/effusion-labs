FROM node:24-alpine AS base
WORKDIR /app

# Copy gateway code and a minimal package.json for container runtime deps
COPY package.json ./package.json
RUN npm install --omit=dev

COPY . .
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    PROFILE=dev

EXPOSE 3000
CMD ["node","server.mjs"]
