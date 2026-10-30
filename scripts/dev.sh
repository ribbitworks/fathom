#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Starts development mode: the development database, with migrations applied, Fathom's server, and
# Vite's development server for the front end, which opens Fathom at https://localhost:8443 in the
# browser. Vite forwards API requests to the server over HTTPS, and both reload when their code
# changes. Run 'pnpm dev:setup' first. Set FATHOM_DEV_PORT and FATHOM_DEV_API_PORT to use other
# ports, and FATHOM_DEV_OPEN=false to not open the browser.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

for file in .dev/certs/localhost.pem .dev/certs/localhost-key.pem .dev/secrets/fathom_auth_secret; do
  [ -s "$file" ] || fail "The development certificate or secrets are missing; run 'pnpm dev:setup' first"
done
command -v mkcert >/dev/null 2>&1 ||
  fail "mkcert is required to trust the development certificate (https://github.com/FiloSottile/mkcert)"
ca_file="$(mkcert -CAROOT)/rootCA.pem"
[ -s "$ca_file" ] || fail "mkcert's certificate authority is missing; run 'pnpm dev:setup' again"

bash scripts/dev-db.sh up
bash scripts/dev-db.sh migrate

port="${FATHOM_DEV_PORT:-8443}"
info "Starting Fathom at https://localhost:$port"
# Both processes get these settings: the server listens on FATHOM_PORT, and Vite serves the page on
# FATHOM_DEV_PORT with the same certificate, forwarding to the server. NODE_EXTRA_CA_CERTS lets
# Vite check the server's certificate.
FATHOM_DEV_PORT="$port" \
  FATHOM_HOST=127.0.0.1 \
  FATHOM_PORT="${FATHOM_DEV_API_PORT:-8444}" \
  FATHOM_PUBLIC_URL="https://localhost:$port" \
  FATHOM_AUTH_SECRET_FILE="$PWD/.dev/secrets/fathom_auth_secret" \
  FATHOM_TLS_CERT_FILE="$PWD/.dev/certs/localhost.pem" \
  FATHOM_TLS_KEY_FILE="$PWD/.dev/certs/localhost-key.pem" \
  FATHOM_DB_HOST=127.0.0.1 \
  FATHOM_DB_PORT="${FATHOM_DEV_DB_PORT:-5432}" \
  FATHOM_DB_NAME=fathom \
  FATHOM_DB_USER=fathom_app \
  FATHOM_DB_PASSWORD_FILE="$PWD/.dev/secrets/fathom_app_password" \
  NODE_EXTRA_CA_CERTS="$ca_file" \
  pnpm --parallel --filter @fathom/server --filter @fathom/web dev
