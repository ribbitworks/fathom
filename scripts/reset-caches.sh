#!/usr/bin/env bash
# Removes Fathom's cached scanner data and any leftover scan copies. They are recreated on the next check.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

require_container_runtime

volumes="fathom-trivy-cache fathom-powershell-modules"
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

# Scan copies are removed by the check that made them; only those left over for an hour are removed here.
if [ -d .tmp ]; then
  find .tmp -maxdepth 1 -type d -name 'scan.*' -mmin +60 -exec rm -rf {} +
fi
info "Done"
