# shellcheck shell=bash
# SPDX-License-Identifier: Apache-2.0

# Shared helpers for Fathom's bash scripts: messages, checks for git and a container runtime, the list
# of project files, the copy of them that containerized scanners read, so they never see ignored
# folders, the password the development accounts share, and a prompt for new passwords. Sourcing it
# also exports FATHOM_SECURITY_FIXES_DATE, the date that decides which security fixes container
# builds fetch, and this copy's development and production-like ports. Source this file; do not
# run it.

info() { printf '==> %s\n' "$*"; }
fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

require_git_repository() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Run this inside the Fathom git repository"
}

# Container images built today pick up the security fixes released up to today; see the Dockerfiles.
# Setting another value, such as the current time, fetches fixes again within the same day.
FATHOM_SECURITY_FIXES_DATE="${FATHOM_SECURITY_FIXES_DATE:-$(date -u +%Y-%m-%d)}"
export FATHOM_SECURITY_FIXES_DATE

# Several copies of the repository can run on one machine at once, each with its own clone number,
# from 1 to 9, in the git-ignored .dev/clone. The number picks the ports and the names of the
# containers, volumes and images, so the copies never share a database or replace each other's
# containers. Clone 1, the default, uses the ports and names a single copy always has.
FATHOM_CLONE=1
fathom_clone_file="$(dirname "${BASH_SOURCE[0]}")/../.dev/clone"
if [ -s "$fathom_clone_file" ]; then
  FATHOM_CLONE="$(tr -d '[:space:]' <"$fathom_clone_file")"
  case "$FATHOM_CLONE" in
    [1-9]) ;;
    *) fail ".dev/clone must hold a clone number from 1 to 9; run 'pnpm dev:setup <number>'" ;;
  esac
fi
unset fathom_clone_file
fathom_clone_offset=$((FATHOM_CLONE - 1))
export FATHOM_DEV_PORT="${FATHOM_DEV_PORT:-$((8443 + 10 * fathom_clone_offset))}"
export FATHOM_DEV_API_PORT="${FATHOM_DEV_API_PORT:-$((8444 + 10 * fathom_clone_offset))}"
export FATHOM_DEV_DB_PORT="${FATHOM_DEV_DB_PORT:-$((5432 + fathom_clone_offset))}"
export FATHOM_STACK_PORT="${FATHOM_STACK_PORT:-$((9443 + 10 * fathom_clone_offset))}"
unset fathom_clone_offset

# Prints the name given, followed by this copy's clone number unless it is clone 1.
clone_name() {
  if [ "$FATHOM_CLONE" = 1 ]; then printf '%s\n' "$1"; else printf '%s-%s\n' "$1" "$FATHOM_CLONE"; fi
}

require_container_runtime() {
  command -v docker >/dev/null 2>&1 || fail "A container runtime is required; see docs/operations/supported-platforms.md"
  docker info >/dev/null 2>&1 || fail "The container runtime is installed but not running"
}

# Prints the files git would track, committed or new but never ignored, that exist on disk.
# Optional arguments are git pathspecs, such as '*.sh'.
list_project_files() {
  local files
  files="$(git ls-files --cached --others --exclude-standard -- "$@")" || fail "Could not list the project's files"
  printf '%s\n' "$files" | while IFS= read -r file; do
    if [ -f "$file" ]; then printf '%s\n' "$file"; fi
  done
}

# Copies the files git would track into a new folder under the git-ignored .tmp/, and prints its
# path. Scanners mount this copy, so they never see ignored folders such as private/. It lives
# inside the repository because every container runtime can share the repository folder, and it is
# made readable to all users because some scanner images run as a non-root user.
make_scan_copy() {
  local copy
  mkdir -p .tmp && chmod 700 .tmp || return 1
  copy="$(mktemp -d "$PWD/.tmp/scan.XXXXXX")" || return 1
  list_project_files . | tar -cf - -T - | tar -xf - -C "$copy" || {
    rm -rf "$copy"
    fail "Could not copy the project's files to $copy"
  }
  chmod -R a+rX "$copy" || return 1
  printf '%s\n' "$copy"
}

# Makes the random password the development accounts share, unless it exists, and prints its
# path. It is kept in the git-ignored .dev/secrets folder, so it stays the same between resets.
dev_account_password_file() {
  local file=".dev/secrets/dev_account_password"
  if [ ! -s "$file" ]; then
    command -v openssl >/dev/null 2>&1 || fail "openssl is required to generate the development accounts' password"
    (umask 077 && openssl rand -hex 12 >"$file") || fail "Could not create $file"
  fi
  printf '%s\n' "$file"
}

# Asks for a new password twice, without showing it, and prints it for the caller to pass on through
# standard input, never as an argument, so it stays out of process listings. It is called inside
# $(...), where older bash does not stop on errors, so each step checks its own result.
read_new_password() {
  local password confirmation
  [ -r /dev/tty ] || fail "A password can only be entered at a terminal"
  printf 'Password: ' >/dev/tty
  IFS= read -rs password </dev/tty || fail "Could not read the password"
  printf '\nPassword again: ' >/dev/tty
  IFS= read -rs confirmation </dev/tty || fail "Could not read the password"
  printf '\n' >/dev/tty
  [ -n "$password" ] || fail "The password is empty"
  [ "$password" = "$confirmation" ] || fail "The passwords do not match"
  printf '%s\n' "$password"
}
