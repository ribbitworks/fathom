#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Manages the development database, a PostgreSQL container built from Fathom's own image and
# reachable only from this machine. Run 'pnpm dev:setup' first to create its secrets.
# Usage: scripts/dev-db.sh up | down | migrate | reset | seed | unseed
#   up       build and start the database, and wait until it is ready
#   down     stop the database, keeping its data
#   migrate  apply the reviewed migrations as the migration role
#   reset    delete the database and its data, then start it and apply the migrations again
#   seed     start the database, apply the migrations, and add the fictional data, unless it is there
#   unseed   remove the fictional data, keeping anything added by hand

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

compose=(docker compose --file deploy/compose.dev.yaml)

start_database() {
  for name in postgres_superuser_password fathom_migrator_password fathom_app_password; do
    [ -s ".dev/secrets/$name" ] || fail "Development secrets are missing; run 'pnpm dev:setup' first"
  done
  info "Building and starting the development database"
  "${compose[@]}" up --build --detach --wait
}

apply_migrations() {
  info "Applying migrations as the migration role"
  FATHOM_DB_HOST=127.0.0.1 \
    FATHOM_DB_PORT="${FATHOM_DEV_DB_PORT:-5432}" \
    FATHOM_DB_NAME=fathom \
    FATHOM_DB_USER=fathom_migrator \
    FATHOM_DB_PASSWORD_FILE="$PWD/.dev/secrets/fathom_migrator_password" \
    pnpm --filter @fathom/db migrate
}

# Adds or removes the fictional data as the application role, as Fathom itself would.
run_seed() {
  start_database
  apply_migrations
  FATHOM_DB_HOST=127.0.0.1 \
    FATHOM_DB_PORT="${FATHOM_DEV_DB_PORT:-5432}" \
    FATHOM_DB_NAME=fathom \
    FATHOM_DB_USER=fathom_app \
    FATHOM_DB_PASSWORD_FILE="$PWD/.dev/secrets/fathom_app_password" \
    node packages/seed/src/seed.ts "$1"
}

require_container_runtime
case "${1:-}" in
  up) start_database ;;
  down) "${compose[@]}" down ;;
  migrate) apply_migrations ;;
  reset)
    info "Deleting the development database"
    "${compose[@]}" down --volumes
    start_database
    apply_migrations
    ;;
  seed | unseed) run_seed "$1" ;;
  *) fail "Usage: scripts/dev-db.sh up | down | migrate | reset | seed | unseed" ;;
esac
