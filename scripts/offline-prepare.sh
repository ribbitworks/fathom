#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Fetches, while connected, what 'pnpm check --offline' needs: the scanners' images, the image
# Testcontainers starts beside each test database, Semgrep's rules, Trivy's vulnerability database,
# and this copy's database image, built with today's security fixes.

set -euo pipefail
cd "$(dirname "$0")/.."
# Offline settings would build the database image with the fixes fetched last time.
unset FATHOM_OFFLINE
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

semgrep_rules_address="https://semgrep.dev/c/p/default"

main() {
  local image ryuk
  [ "$#" -eq 0 ] || fail "Usage: offline-prepare.sh"
  require_git_repository
  require_container_runtime
  require_connection
  mkdir -p "$fathom_offline_dir"
  # Until every step is done, this copy isn't ready, so a preparation stopped part way never counts.
  rm -f "$fathom_prepared_day"

  info "Pulling the scanners' images, and the image Testcontainers starts beside each test database"
  ryuk="$(node scripts/offline.mjs ryuk-image)"
  for image in "$fathom_trivy_image" "$fathom_gitleaks_image" "$fathom_semgrep_image" "$ryuk"; do
    docker pull --quiet "$image" >/dev/null || fail "Could not pull $image"
  done

  info "Keeping a copy of Semgrep's rules in $fathom_semgrep_rules"
  NODE_USE_ENV_PROXY=1 node scripts/offline.mjs rules "$semgrep_rules_address" "$fathom_semgrep_rules" ||
    fail "Could not keep Semgrep's rules"

  info "Updating Trivy's vulnerability database"
  hold_trivy_cache
  trap release_trivy_cache EXIT
  update_trivy_database >/dev/null || fail "Could not update Trivy's vulnerability database"
  release_trivy_cache

  info "Building this copy's database image with the security fixes of $FATHOM_SECURITY_FIXES_DATE"
  build_dev_database_image "Could not build the database image; see the build's output above"

  printf '%s\n' "$FATHOM_SECURITY_FIXES_DATE" >"$fathom_prepared_day"
  info "Ready to work offline. Run this again after pulling changes that update an image or the database image's Dockerfile"
}

main "$@"
