# shellcheck shell=bash
# Shared helpers for Fathom's bash scripts. Source this file; do not run it.

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
