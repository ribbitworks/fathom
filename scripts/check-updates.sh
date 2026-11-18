#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Lists available dependency updates with Renovate, run locally as a container, and writes a report
# to output/updates/<time>/. It changes nothing; updates are applied as separate, reviewed changes.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

require_git_repository
require_container_runtime

report_dir="$PWD/output/updates/$(date -u +%Y-%m-%dT%H-%M-%SZ)"
mkdir -p "$report_dir"

scan_copy="$(make_scan_copy)"
trap 'rm -rf "$scan_copy"' EXIT

info "Looking up dependency updates"
if ! docker run --rm --volume "$scan_copy:/usr/src/app:ro" --workdir /usr/src/app \
  --env LOG_LEVEL=debug --env LOG_FORMAT=json \
  --env RENOVATE_PLATFORM=local --env RENOVATE_DRY_RUN=lookup \
  "$fathom_renovate_image" >"$report_dir/renovate.jsonl" 2>"$report_dir/renovate-errors.log"; then
  info "Renovate did not complete. The end of its error output:"
  tail -n 20 "$report_dir/renovate-errors.log" >&2
fi

node scripts/updates-summary.mjs "$report_dir"
