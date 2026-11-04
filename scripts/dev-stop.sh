#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Stops this copy's development servers, which 'pnpm dev' started, wherever they were started from.
# It leaves the development database running; 'pnpm db:down' stops that.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

stop_dev_servers
