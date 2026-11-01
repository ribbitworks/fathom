#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Starts development mode from a fresh development database: deletes the database and applies the
# migrations again, adds the fictional data and the development accounts, one for each persona,
# printing the password they share, then starts Fathom as 'pnpm dev' does. Development only: it
# deletes every account and record in the development database. Run 'pnpm dev:setup' first.

set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/dev-db.sh reset
bash scripts/dev-db.sh seed
exec bash scripts/dev.sh
