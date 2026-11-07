#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Creates an account in the development database, printing once the password Fathom generates.
# Usage: pnpm account:create --name "Fictional Person" --email person@example.test [--role <role>]

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

run_dev_account_command apps/server/src/create-account.ts "$@"
