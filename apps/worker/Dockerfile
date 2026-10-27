# syntax=docker/dockerfile:1
# Built from the repository root: docker build -f apps/worker/Dockerfile .

FROM node:24-slim AS base
ENV npm_config_store_dir=/pnpm/store COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch
COPY . .

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter @hobai/worker...
RUN pnpm --filter @hobai/worker build

# Only what this app needs at runtime. The bundle also imports our packages' npm packages, so all are
# hoisted to the top, where it can see them. --no-optional leaves out the web app's next and react,
# which reach this app as optional peers of better-auth.
FROM base AS deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --prod --no-optional --shamefully-hoist --filter @hobai/worker...

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=build /repo/apps/worker/package.json ./
COPY --from=build /repo/apps/worker/dist ./dist
USER node
# Started directly, not through a shell or pnpm, so node receives Docker's SIGTERM and finishes the work in progress.
CMD ["node", "--enable-source-maps", "dist/index.js"]
