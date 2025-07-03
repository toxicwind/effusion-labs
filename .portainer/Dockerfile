# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx @11ty/eleventy

# Runtime stage
FROM nginx:stable-alpine
COPY --from=builder /app/_site/ /usr/share/nginx/html/
COPY .portainer/nginx.conf /etc/nginx/conf.d/default.conf
