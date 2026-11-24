#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Runs the UI tests in a real browser against this copy's development server, on fresh fictional
# data. Usage: test-ui.sh [Playwright's arguments, such as a test file]

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

main() {
  local url="https://localhost:$FATHOM_DEV_PORT" password_file
  curl --silent --max-time 10 --cacert "$(mkcert -CAROOT)/rootCA.pem" --output /dev/null "$url/" ||
    fail "Fathom isn't answering at $url; start it with 'pnpm dev', then try again"
  password_file="$PWD/$(dev_account_password_file)"
  bash scripts/dev-db.sh reseed
  pnpm --filter @fathom/web exec playwright install chromium
  FATHOM_UI_URL="$url" FATHOM_UI_PASSWORD_FILE="$password_file" \
    pnpm --filter @fathom/web exec playwright test "$@"
}

main "$@"
