# syntax=docker/dockerfile:1
# Built from the repository root: docker build -f apps/server/Dockerfile .

FROM node:24-slim AS base
ENV npm_config_store_dir=/pnpm/store COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
RUN corepack enable
WORKDIR /repo
COPY . .

FROM base AS build
# The store mount only speeds installs up; it can be empty (CI, a pruned cache), so nothing relies on it.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --filter @hobai/server...
RUN pnpm --filter @hobai/server build

# Only what this app needs at runtime. The bundle also imports our packages' npm packages, so all are
# hoisted to the top, where it can see them. --no-optional leaves out the web app's next and react,
# which reach this app as optional peers of better-auth.
FROM base AS deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --prod --no-optional --shamefully-hoist --filter @hobai/server...

FROM node:24-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000
WORKDIR /app
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=build /repo/apps/server/package.json ./
COPY --from=build /repo/apps/server/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --start-period=30s --start-interval=2s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# exec: node replaces the shell, so it receives Docker's SIGTERM itself.
CMD ["sh", "-c", "node --enable-source-maps dist/migrate.js && exec node --enable-source-maps dist/index.js"]
