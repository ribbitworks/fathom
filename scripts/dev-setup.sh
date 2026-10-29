#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Creates development-only secrets in the git-ignored .dev/ folder. Existing secrets are kept, so it
# is safe to run repeatedly. Production secrets are never created or stored here.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

command -v openssl >/dev/null 2>&1 || fail "openssl is required to generate secrets"

secrets_dir=".dev/secrets"
mkdir -p "$secrets_dir"
# Only the developer can open .dev/. The files inside are readable by the database container's own
# user, which cannot otherwise read them, while the folder keeps them private on this machine.
chmod 700 .dev "$secrets_dir"

for name in postgres_superuser_password fathom_migrator_password fathom_app_password; do
  file="$secrets_dir/$name"
  if [ ! -s "$file" ]; then
    info "Creating $file"
    openssl rand -hex 32 >"$file"
  fi
  chmod 644 "$file"
done

info "Done"
