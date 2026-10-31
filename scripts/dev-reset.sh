#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Starts development mode from a fresh development database: deletes the database and applies the
# migrations again, creates an account for "Your Name" (you@example.test) with the Administrator and
# Workforce Administrator roles, then starts Fathom as 'pnpm dev' does. The account's password is
# random, kept in the git-ignored .dev/secrets folder so it stays the same between resets, and
# printed before Fathom starts. Development only: it deletes every account and record in the
# development database. Run 'pnpm dev:setup' first.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

[ -s .dev/secrets/fathom_auth_secret ] || fail "Development secrets are missing; run 'pnpm dev:setup' first"
command -v openssl >/dev/null 2>&1 || fail "openssl is required to generate the account's password"

password_file=".dev/secrets/dev_account_password"
if [ ! -s "$password_file" ]; then
  (umask 077 && openssl rand -hex 12 >"$password_file")
fi

bash scripts/dev-db.sh reset

info "Creating the account for Your Name"
FATHOM_PUBLIC_URL="https://localhost:${FATHOM_DEV_PORT:-8443}" \
  FATHOM_AUTH_SECRET_FILE="$PWD/.dev/secrets/fathom_auth_secret" \
  FATHOM_DB_HOST=127.0.0.1 \
  FATHOM_DB_PORT="${FATHOM_DEV_DB_PORT:-5432}" \
  FATHOM_DB_NAME=fathom \
  FATHOM_DB_USER=fathom_app \
  FATHOM_DB_PASSWORD_FILE="$PWD/.dev/secrets/fathom_app_password" \
  node apps/server/src/create-account.ts \
  --name "Your Name" \
  --email you@example.test \
  --role administrator \
  --role workforce-administrator <"$password_file"

info "Sign in as you@example.test with the password $(cat "$password_file")"
exec bash scripts/dev.sh
