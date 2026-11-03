#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Creates development-only secrets and a locally trusted HTTPS certificate in the git-ignored .dev/
# folder. Existing secrets are kept, and the certificate is kept until it is within 30 days of
# expiring, so it is safe to run repeatedly. Production secrets are never created or stored here.
# Creating the certificate asks mkcert to add its local certificate authority to this machine's
# trusted certificates the first time, which may ask for your password.
# Usage: scripts/dev-setup.sh [clone number]
#   clone number  from 1 to 9, kept in .dev/clone, for a copy of the repository that runs alongside
#                 others on this machine; see scripts/lib.sh

set -euo pipefail
cd "$(dirname "$0")/.."

# Written before scripts/lib.sh reads it, so this also replaces a number it would reject.
case "${1:-}" in
  '') ;;
  [1-9]) mkdir -p .dev && chmod 700 .dev && printf '%s\n' "$1" >.dev/clone ;;
  *)
    printf 'error: %s\n' "Usage: scripts/dev-setup.sh [clone number from 1 to 9]" >&2
    exit 1
    ;;
esac

# shellcheck source=scripts/lib.sh
source scripts/lib.sh

command -v openssl >/dev/null 2>&1 || fail "openssl is required to generate secrets"

renewal_seconds=$((30 * 24 * 60 * 60))

secrets_dir=".dev/secrets"
mkdir -p "$secrets_dir"
# Only the developer can open .dev/. The files inside are readable by the containers' own users,
# which cannot otherwise read them, while the folder keeps them private on this machine.
chmod 700 .dev "$secrets_dir"

for name in postgres_superuser_password fathom_migrator_password fathom_app_password fathom_auth_secret; do
  file="$secrets_dir/$name"
  if [ ! -s "$file" ]; then
    info "Creating $file"
    openssl rand -hex 32 >"$file"
  fi
  chmod 644 "$file"
done

certs_dir=".dev/certs"
mkdir -p "$certs_dir"
chmod 700 "$certs_dir"
if [ ! -s "$certs_dir/localhost-key.pem" ] ||
  ! openssl x509 -checkend "$renewal_seconds" -noout -in "$certs_dir/localhost.pem" >/dev/null 2>&1; then
  command -v mkcert >/dev/null 2>&1 ||
    fail "mkcert is required to create the HTTPS certificate (https://github.com/FiloSottile/mkcert)"
  info "Creating a locally trusted HTTPS certificate in $certs_dir"
  # The certificate authority's own key stays in mkcert's folder and is never copied here.
  mkcert -install
  mkcert -cert-file "$certs_dir/localhost.pem" -key-file "$certs_dir/localhost-key.pem" \
    localhost 127.0.0.1 ::1
fi
chmod 644 "$certs_dir/localhost-key.pem"

info "This copy is clone $FATHOM_CLONE: development mode is at https://localhost:$FATHOM_DEV_PORT and production-like mode at https://localhost:$FATHOM_STACK_PORT"
info "Done"
