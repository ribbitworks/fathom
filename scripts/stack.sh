#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Runs Fathom in production-like mode on this machine: the containers from deploy/compose.yaml, built
# for the production server's processor, with the development secrets and certificate. Fathom is
# then at https://localhost:9443, so development mode can run alongside it. Run 'pnpm dev:setup'
# first. Set FATHOM_STACK_PORT to use another port.
# Usage: scripts/stack.sh up | down | reset | logs | create-account --name <name> --email <email>
#   up              build and start the containers, and wait until they are ready
#   down            stop the containers, keeping the database's data
#   reset           delete the containers and the database's data
#   logs            follow the containers' logs
#   create-account  create an account, asking for its password without showing it

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

export FATHOM_HTTPS_PORT="${FATHOM_STACK_PORT:-9443}"
case "$FATHOM_HTTPS_PORT" in
  '' | *[!0-9]*) fail "FATHOM_STACK_PORT must be a port number from 1 to 65535" ;;
esac
FATHOM_HTTPS_PORT="$((10#$FATHOM_HTTPS_PORT))"
if [ "$FATHOM_HTTPS_PORT" -lt 1 ] || [ "$FATHOM_HTTPS_PORT" -gt 65535 ]; then
  fail "FATHOM_STACK_PORT must be a port number from 1 to 65535"
fi
export FATHOM_PUBLIC_URL="https://localhost:$FATHOM_HTTPS_PORT"
compose=(docker compose --project-name fathom-stack --file deploy/compose.yaml)

require_container_runtime
case "${1:-}" in
  up)
    for file in .dev/secrets/postgres_superuser_password .dev/secrets/fathom_migrator_password \
      .dev/secrets/fathom_app_password .dev/secrets/fathom_auth_secret .dev/certs/localhost.pem \
      .dev/certs/localhost-key.pem; do
      [ -s "$file" ] || fail "Development secrets or the certificate are missing; run 'pnpm dev:setup' first"
    done
    info "Building and starting Fathom's containers"
    "${compose[@]}" up --build --detach --wait
    info "Fathom is at https://localhost:$FATHOM_HTTPS_PORT"
    ;;
  down) "${compose[@]}" down ;;
  reset)
    info "Deleting Fathom's containers and the database's data"
    "${compose[@]}" down --volumes
    ;;
  logs) "${compose[@]}" logs --follow ;;
  create-account)
    shift
    password="$(read_new_password)"
    printf '%s\n' "$password" |
      "${compose[@]}" run --rm --no-deps -T app apps/server/src/create-account.ts "$@"
    ;;
  *) fail "Usage: scripts/stack.sh up | down | reset | logs | create-account --name <name> --email <email>" ;;
esac
