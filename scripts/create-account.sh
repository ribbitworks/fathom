#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Creates an account in the development database, asking for its password without showing it.
# Usage: pnpm account:create --name "Fictional Person" --email person@example.test

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

[ -s .dev/secrets/fathom_auth_secret ] || fail "Development secrets are missing; run 'pnpm dev:setup' first"
bash scripts/dev-db.sh up
bash scripts/dev-db.sh migrate

password="$(read_new_password)"
printf '%s\n' "$password" |
  FATHOM_PUBLIC_URL="https://localhost:${FATHOM_DEV_PORT:-8443}" \
    FATHOM_AUTH_SECRET_FILE="$PWD/.dev/secrets/fathom_auth_secret" \
    FATHOM_DB_HOST=127.0.0.1 \
    FATHOM_DB_PORT="${FATHOM_DEV_DB_PORT:-5432}" \
    FATHOM_DB_NAME=fathom \
    FATHOM_DB_USER=fathom_app \
    FATHOM_DB_PASSWORD_FILE="$PWD/.dev/secrets/fathom_app_password" \
    node apps/server/src/create-account.ts "$@"
