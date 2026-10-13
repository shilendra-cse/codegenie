#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() {
  printf '\n==> %s\n' "$*"
}

warn() {
  printf 'warning: %s\n' "$*" >&2
}

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f apps/server/docker-compose.yml "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f apps/server/docker-compose.yml "$@"
  else
    printf "Neither 'docker compose' nor 'docker-compose' is available.\n" >&2
    exit 1
  fi
}

copy_env_if_missing() {
  local example="$1"
  local target="$2"

  if [[ -f "$target" ]]; then
    printf 'Keeping existing %s\n' "$target"
    return
  fi

  cp "$example" "$target"
  printf 'Created %s\n' "$target"
}

wait_for() {
  local label="$1"
  shift

  for _ in $(seq 1 30); do
    if "$@" >/dev/null 2>&1; then
      printf '%s is ready\n' "$label"
      return
    fi
    sleep 2
  done

  printf '%s did not become ready in time.\n' "$label" >&2
  exit 1
}

require node
require pnpm
require docker

if ! docker info >/dev/null 2>&1; then
  printf 'Docker is installed, but the daemon is not running. Start Docker Desktop and run this script again.\n' >&2
  exit 1
fi

log "Installing dependencies"
pnpm install

log "Environment files"
copy_env_if_missing apps/server/.env.example apps/server/.env
copy_env_if_missing apps/agent/.env.example apps/agent/.env

if grep -q 'your-openai-api-key' apps/agent/.env; then
  warn "Set OPENAI_API_KEY in apps/agent/.env before running the agent."
fi

if grep -q 'your-github-client-id' apps/server/.env; then
  warn "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in apps/server/.env before GitHub sign-in."
fi

if grep -q 'your-google-client-id' apps/server/.env; then
  warn "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in apps/server/.env before Google sign-in."
fi

log "Starting Postgres and Redis"
compose up -d

log "Waiting for databases"
wait_for "Postgres" compose exec -T postgres pg_isready -U codegenie_user -d codegenie_db
wait_for "Redis" compose exec -T redis redis-cli ping

log "Running database migrations"
pnpm --filter @codegenie/server db:migrate

cat <<'EOF'

Setup complete.

Start each app in its own terminal, from the repo root:

  pnpm dev:server   API at http://localhost:3001
  pnpm dev:web      UI at http://localhost:3000
  pnpm dev:agent    terminal coding agent

Sign-in is at http://localhost:3000/signin
EOF
