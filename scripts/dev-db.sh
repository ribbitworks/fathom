#!/usr/bin/env bash
# Manages the development database.
# Usage: scripts/dev-db.sh up | down | migrate | reset
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

compose=(docker compose --file deploy/compose.dev.yaml)

start_database() {
  for name in postgres_superuser_password fathom_migrator_password fathom_app_password; do
    [ -s ".dev/secrets/$name" ] || fail "Development secrets are missing; run 'pnpm run dev:setup' first"
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
  *) fail "Usage: scripts/dev-db.sh up | down | migrate | reset" ;;
esac
