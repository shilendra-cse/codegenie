# codegenie-base: the image every sandbox container starts from.
# Build: pnpm sandbox:build-image
# node:24-bookworm already ships git, curl, python3, make/gcc (node-gyp), timeout, find and ps.
FROM node:24-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends ripgrep fd-find \
  && ln -s /usr/bin/fdfind /usr/local/bin/fd \
  && rm -rf /var/lib/apt/lists/*

# pnpm and yarn via corepack
RUN corepack enable

# Non-interactive by default, for every command (setup, checks, the agent's bash):
# - CI=true: test runners (vitest, jest) run once instead of starting in watch mode
# - corepack downloads the package manager a repo asks for without a Y/n prompt
ENV CI=true \
  COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# The agent runs as a non-root user and works in /workspace
RUN useradd -m -s /bin/bash agent \
  && mkdir /workspace \
  && chown agent:agent /workspace

USER agent
WORKDIR /workspace

RUN git config --global user.name "CodeGenie" \
  && git config --global user.email "bot@codegenie.dev" \
  && git config --global --add safe.directory /workspace \
  && git config --global init.defaultBranch main
