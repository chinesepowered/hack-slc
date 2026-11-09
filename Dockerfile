# Build the web app and the server bundle with pnpm, then ship only what runs.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY app/package.json app/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY app/ .
RUN pnpm build && pnpm prune --prod

FROM node:22-alpine
WORKDIR /app
ARG APP_VERSION=dev
ENV NODE_ENV=production PORT=8080 APP_VERSION=$APP_VERSION
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
# The node image's "node" user, by number so runAsNonRoot can check it.
USER 1000
EXPOSE 8080
CMD ["node", "--require", "./dist/telemetry.cjs", "./dist/server.cjs"]
