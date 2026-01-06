FROM node:24-alpine AS build
WORKDIR /app
COPY package.json ./package.json
RUN npm install --omit=dev
COPY . .

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app /app
RUN addgroup -S app && adduser -S app -G app
USER app
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    PROFILE=dev
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node","server.mjs"]
