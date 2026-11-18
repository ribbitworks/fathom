#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Validates renovate.json with Renovate's own validator, strictly, so settings it would refuse or
# migrate fail the check, when renovate.json changed since this branch left origin/main, or when
# that can't be told. Run by 'pnpm check'.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

main() {
  local changed
  if ! changed="$(node scripts/changed-paths.mjs)"; then
    info "Could not tell whether renovate.json changed since origin/main, so it is validated"
  elif ! printf '%s\n' "$changed" | grep -qx 'renovate.json'; then
    info "renovate.json has not changed since origin/main, so it is not validated"
    return 0
  fi
  require_container_runtime
  docker run --rm --network none --volume "$PWD/renovate.json:/usr/src/app/renovate.json:ro" \
    --workdir /usr/src/app --entrypoint renovate-config-validator "$fathom_renovate_image" --strict ||
    fail "renovate.json is not valid; see the validator's output above"
}

main "$@"
