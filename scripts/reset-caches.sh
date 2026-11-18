#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Removes Fathom's cached scanner data, ESLint's cache, and any leftover scan copies and check logs.
# Each cache is recreated the next time the tool that uses it runs.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

rm -rf .tmp/eslint

require_container_runtime

volumes="$(clone_name fathom-trivy-cache)"
for volume in $volumes; do
  if [ -n "$(docker ps --quiet --filter "volume=$volume")" ]; then
    fail "A running check is using $volume; try again when it finishes"
  fi
done

for volume in $volumes; do
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    info "Removing $volume"
    docker volume rm "$volume" >/dev/null
  fi
done

# Scan copies and the check's job logs are removed by the run that made them; only those left over
# for an hour are removed here.
if [ -d .tmp ]; then
  find .tmp -maxdepth 1 -type d \( -name 'scan.*' -o -name 'check.*' \) -mmin +60 -exec rm -rf {} +
fi
info "Done"
