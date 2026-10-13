#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() {
  printf '\n==> %s\n' "$*"
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

require pnpm
require docker

if [[ ! -f apps/server/.env ]]; then
  printf 'Missing apps/server/.env. Run pnpm setup first.\n' >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  printf 'Docker is installed, but the daemon is not running. Start Docker Desktop and run this script again.\n' >&2
  exit 1
fi

log "Starting Postgres"
compose up -d postgres

log "Waiting for Postgres"
wait_for "Postgres" compose exec -T postgres pg_isready -U codegenie_user -d codegenie_db

log "Applying database migrations"
pnpm --filter @codegenie/server db:migrate

printf '\nMigrations applied.\n'
