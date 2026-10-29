#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Starts development mode: the development database, with migrations applied, and Fathom's server
# over HTTPS at https://localhost:8443, connected as the application's database role and restarted
# when its code changes. Run 'pnpm dev:setup' first. Set FATHOM_DEV_PORT to use another port.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

for file in .dev/certs/localhost.pem .dev/certs/localhost-key.pem; do
  [ -s "$file" ] || fail "The development certificate is missing; run 'pnpm dev:setup' first"
done

bash scripts/dev-db.sh up
bash scripts/dev-db.sh migrate

info "Starting the server at https://localhost:${FATHOM_DEV_PORT:-8443}"
FATHOM_HOST=127.0.0.1 \
  FATHOM_PORT="${FATHOM_DEV_PORT:-8443}" \
  FATHOM_TLS_CERT_FILE="$PWD/.dev/certs/localhost.pem" \
  FATHOM_TLS_KEY_FILE="$PWD/.dev/certs/localhost-key.pem" \
  FATHOM_DB_HOST=127.0.0.1 \
  FATHOM_DB_PORT="${FATHOM_DEV_DB_PORT:-5432}" \
  FATHOM_DB_NAME=fathom \
  FATHOM_DB_USER=fathom_app \
  FATHOM_DB_PASSWORD_FILE="$PWD/.dev/secrets/fathom_app_password" \
  pnpm --filter @fathom/server dev
