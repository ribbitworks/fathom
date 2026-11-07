#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Creates the Fathom Administrator account in the development database, unless an account already
# holds the Administrator role, printing the password Fathom generates for it once.
# Usage: pnpm admin:create --email admin@example.test

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

run_dev_account_command apps/server/src/create-administrator.ts "$@"
