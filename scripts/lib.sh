# shellcheck shell=bash
# SPDX-License-Identifier: Apache-2.0

# Shared helpers for Fathom's bash scripts, and the settings they share, such as this copy's ports.
# Source this file; do not run it.

info() { printf '==> %s\n' "$*"; }
fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

require_git_repository() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Run this inside the Fathom git repository"
}

# What 'pnpm offline:prepare' keeps for working offline, in this copy's git-ignored .cache/: Semgrep's
# rules, whose licence keeps them out of the repository, and the day the database image was built.
# The rules come as JSON, which Semgrep reads as YAML.
fathom_offline_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.cache/offline"
# shellcheck disable=SC2034 # Read by the scripts that source this file.
fathom_semgrep_rules="$fathom_offline_dir/semgrep-rules.yaml"
fathom_prepared_day="$fathom_offline_dir/security-fixes-date"

# Container images built today pick up the security fixes released up to today; see the Dockerfiles.
# Setting another value, such as the current time, fetches fixes again within the same day. With
# FATHOM_OFFLINE set, images are built with the fixes 'pnpm offline:prepare' fetched, whatever else
# is set, since the build then reuses that image's layers, and fetching any other fixes needs the
# internet.
use_prepared_fixes() {
  if [ -n "${FATHOM_OFFLINE:-}" ] && [ -s "$fathom_prepared_day" ]; then
    FATHOM_SECURITY_FIXES_DATE="$(cat "$fathom_prepared_day")"
    export FATHOM_SECURITY_FIXES_DATE
  fi
}
use_prepared_fixes
FATHOM_SECURITY_FIXES_DATE="${FATHOM_SECURITY_FIXES_DATE:-$(date -u +%Y-%m-%d)}"
export FATHOM_SECURITY_FIXES_DATE

fathom_git() { git -C "$(dirname "${BASH_SOURCE[0]}")" "$@"; }

# Succeeds when the tag is a release under semantic versioning: vMAJOR.MINOR.PATCH, with no leading
# zeros in its numbers, perhaps followed by a pre-release such as -rc.1, but without build metadata
# such as +7.
fathom_is_release_tag() {
  local number='(0|[1-9][0-9]*)' part='(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
  local release="^v$number\\.$number\\.$number(-$part(\\.$part)*)?\$"
  [[ $1 =~ $release ]]
}

# Succeeds when the whole number $1 is greater than $2, compared as text so no size overflows.
fathom_number_after() {
  local LC_ALL=C
  [ "${#1}" -gt "${#2}" ] || { [ "${#1}" -eq "${#2}" ] && [[ $1 > $2 ]]; }
}

# Succeeds when release tag $1 comes after release tag $2 in semantic versioning's order: by major,
# minor and patch, then a release after its pre-releases, then pre-releases part by part, where
# numbers come before words and a longer pre-release after one it begins with.
fathom_release_after() {
  local LC_ALL=C a="${1#v}" b="${2#v}" a_pre="" b_pre="" a_part b_part i
  local -a a_parts b_parts
  case "$a" in
    *-*)
      a_pre="${a#*-}"
      a="${a%%-*}"
      ;;
  esac
  case "$b" in
    *-*)
      b_pre="${b#*-}"
      b="${b%%-*}"
      ;;
  esac
  IFS=. read -r -a a_parts <<<"$a"
  IFS=. read -r -a b_parts <<<"$b"
  for i in 0 1 2; do
    if fathom_number_after "${a_parts[i]}" "${b_parts[i]}"; then return 0; fi
    if fathom_number_after "${b_parts[i]}" "${a_parts[i]}"; then return 1; fi
  done
  if [ -z "$a_pre" ] || [ -z "$b_pre" ]; then
    [ -z "$a_pre" ] && [ -n "$b_pre" ]
    return
  fi
  IFS=. read -r -a a_parts <<<"$a_pre"
  IFS=. read -r -a b_parts <<<"$b_pre"
  for ((i = 0; i < ${#a_parts[@]} && i < ${#b_parts[@]}; i++)); do
    a_part="${a_parts[i]}"
    b_part="${b_parts[i]}"
    [ "$a_part" = "$b_part" ] && continue
    case "$a_part$b_part" in
      *[!0-9]*)
        if [[ $a_part == *[!0-9]* && $b_part == *[!0-9]* ]]; then
          [[ $a_part > $b_part ]]
        else
          [[ $a_part == *[!0-9]* ]]
        fi
        ;;
      *) fathom_number_after "$a_part" "$b_part" ;;
    esac
    return
  done
  [ "${#a_parts[@]}" -gt "${#b_parts[@]}" ]
}

# Prints the release this commit belongs to, from the nearest release tag in its history, such as
# 0.3.0, followed by +4 when it is 4 commits after that tag. When several release tags mark that
# commit, the latest release is used. Prints nothing before the first release.
fathom_release() {
  local tag described commits release
  local -a skipped=()
  while IFS= read -r tag; do
    if ! fathom_is_release_tag "$tag"; then skipped+=(--exclude "$tag"); fi
  done < <(fathom_git tag --list 'v*' 2>/dev/null)
  described="$(fathom_git describe --tags --long --match 'v*' ${skipped[@]+"${skipped[@]}"} 2>/dev/null)" ||
    return 0
  # Such as v0.3.0-4-gabc1234: the tag, the commits since it, and this commit.
  described="${described%-g*}"
  commits="${described##*-}"
  release="${described%-*}"
  while IFS= read -r tag; do
    if fathom_is_release_tag "$tag" && fathom_release_after "$tag" "$release"; then release="$tag"; fi
  done < <(fathom_git tag --points-at "$release^{commit}" 2>/dev/null)
  if [ "$commits" = 0 ]; then printf '%s\n' "${release#v}"; else printf '%s+%s\n' "${release#v}" "$commits"; fi
}

# Prints the short commit, followed by -modified when the files differ from it, since then the
# commit alone would not say what is running.
fathom_commit() {
  local commit
  commit="$(fathom_git rev-parse --short HEAD 2>/dev/null)" || return 0
  if [ -n "$(fathom_git status --porcelain 2>/dev/null)" ]; then commit="$commit-modified"; fi
  printf '%s\n' "$commit"
}

# The release, commit and commit date Help's About box shows. The container build cannot see .git,
# so the scripts read them here and pass them to the build. The commit's date, as its committer's
# clock gave it, is used rather than the day of the build, so building one commit always gives the
# same image, as the security plan's repeatable releases need, and the cache keeps it. Each can be
# set to override it, even to nothing, since an empty release means one before the first. Scripts
# that do not need git still run without it, which leaves them empty.
FATHOM_VERSION="${FATHOM_VERSION-$(fathom_release)}"
FATHOM_COMMIT="${FATHOM_COMMIT-$(fathom_commit)}"
FATHOM_COMMIT_DATE="${FATHOM_COMMIT_DATE-$(fathom_git log -1 --format=%cs 2>/dev/null || true)}"
export FATHOM_VERSION FATHOM_COMMIT FATHOM_COMMIT_DATE

# Several copies of the repository can run on one machine at once, each with its own clone number,
# from 1 to 9, in the git-ignored .dev/clone. The number picks the ports and the names of the
# containers, volumes and images, so the copies never share a database or replace each other's
# containers. A single copy, with no number, has clone 1's ports and names without a number.
FATHOM_CLONE=1
fathom_clone_suffix=""
fathom_clone_file="$(dirname "${BASH_SOURCE[0]}")/../.dev/clone"
if [ -s "$fathom_clone_file" ]; then
  fathom_clone_number="$(tr -d '[:space:]' <"$fathom_clone_file")"
  case "$fathom_clone_number" in
    '') ;;
    [1-9])
      FATHOM_CLONE="$fathom_clone_number"
      fathom_clone_suffix="-$FATHOM_CLONE"
      ;;
    *) fail ".dev/clone must hold a clone number from 1 to 9; run 'pnpm dev:setup <number>'" ;;
  esac
  unset fathom_clone_number
fi
unset fathom_clone_file
fathom_clone_offset=$((FATHOM_CLONE - 1))
export FATHOM_DEV_PORT="${FATHOM_DEV_PORT:-$((8443 + 10 * fathom_clone_offset))}"
export FATHOM_DEV_API_PORT="${FATHOM_DEV_API_PORT:-$((8444 + 10 * fathom_clone_offset))}"
export FATHOM_DEV_DB_PORT="${FATHOM_DEV_DB_PORT:-$((5432 + fathom_clone_offset))}"
export FATHOM_STACK_PORT="${FATHOM_STACK_PORT:-$((9443 + 10 * fathom_clone_offset))}"
unset fathom_clone_offset

# Prints the name given, followed by this copy's clone number if it has one.
clone_name() {
  printf '%s%s\n' "$1" "$fathom_clone_suffix"
}

# Whether any of the processes given is still running, whoever owns it.
any_running() {
  local pid
  for pid in "$@"; do
    if ps -p "$pid" >/dev/null 2>&1; then return 0; fi
  done
  return 1
}

# The working folder of a process, or nothing once it has exited or cannot be read.
folder_of() {
  lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' || true
}

# The program a process runs, such as node, or nothing once it has exited or cannot be read. Read
# from the executable rather than ps's command name, which Linux takes from the main thread's name,
# such as MainThread for Node.js.
program_of() {
  local program
  program="$(lsof -a -p "$1" -d txt -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true)"
  if [ -n "$program" ]; then basename "$program"; fi
}

# Stops whatever listens on this copy's development ports from inside this checkout, such as a
# 'pnpm dev' left running in another terminal or by an agent, so a new one can start. A port held
# by another program, or by another copy, fails with the process's name before anything is
# stopped, since stopping it could lose someone else's work. Without lsof nothing can be found, so
# nothing is stopped.
stop_dev_servers() {
  command -v lsof >/dev/null 2>&1 || return 0
  local root port pid folder name message
  local found=()
  root="$(pwd -P)"
  for port in "$FATHOM_DEV_PORT" "$FATHOM_DEV_API_PORT"; do
    for pid in $(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true); do
      folder="$(folder_of "$pid")"
      # A server can exit between the two lookups, such as when pnpm ends the other one.
      if [ -z "$folder" ] && ! any_running "$pid"; then continue; fi
      case "$folder/" in
        "$root"/*)
          found+=("$pid")
          continue
          ;;
      esac
      message="Port $port is in use by process $pid"
      name="$(program_of "$pid")"
      if [ -n "$name" ]; then message="$message, $name"; fi
      if [ -n "$folder" ]; then message="$message, in $folder"; fi
      fail "$message, which is not this copy's; stop it, or set FATHOM_DEV_PORT and FATHOM_DEV_API_PORT"
    done
  done
  [ "${#found[@]}" -gt 0 ] || return 0
  for pid in "${found[@]}"; do kill "$pid" 2>/dev/null || true; done
  local tries=0
  while [ "$tries" -lt 50 ] && any_running "${found[@]}"; do
    sleep 0.1
    tries=$((tries + 1))
  done
  local left=()
  for pid in "${found[@]}"; do
    if any_running "$pid"; then kill -9 "$pid" 2>/dev/null || true; fi
    if any_running "$pid"; then left+=("$pid"); fi
  done
  [ "${#left[@]}" -eq 0 ] || fail "Could not stop process ${left[*]}; stop it by hand"
  info "Stopped this copy's development servers that were still running"
}

# Trivy, which the security report and the image scans share.
fathom_trivy_image="aquasec/trivy:0.76.2@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb"
# The security report's other scanners, which 'pnpm offline:prepare' pulls too.
# shellcheck disable=SC2034 # Read by the scripts that source this file.
fathom_gitleaks_image="zricethezav/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f"
# shellcheck disable=SC2034 # Read by the scripts that source this file.
fathom_semgrep_image="semgrep/semgrep:1.186.0@sha256:6e1b04340e60e910fbb4ddbf3c857ab0918f064417ad5ac530014ccb3cf8c8f1"
# Renovate, which lists dependency updates and validates its own settings.
# shellcheck disable=SC2034 # Read by the scripts that source this file.
fathom_renovate_image="renovate/renovate:44.252.8@sha256:be84f632bdf6c89a1cf8bc611056ff43ec944dd80617fd93c6039577102e79c7"
# How each image is scanned, all of which decides whether an earlier image scan can be reused.
fathom_image_scan_arguments=(
  image --quiet --skip-version-check --disable-telemetry --skip-db-update --scanners 'vuln,secret'
  --ignorefile /trivyignore.yaml --format json --exit-code 0 --input /image.tar
)
fathom_trivy_lock=".tmp/trivy-cache.lock"

# Every scan container a script starts carries this label, so stop_scan_containers can stop those
# still running when it stops early; docker run's own client leaving does not stop them.
fathom_scan_label="fathom.scan=$$"

stop_scan_containers() {
  local container
  for container in $(docker ps --quiet --filter "label=$fathom_scan_label" 2>/dev/null || true); do
    docker rm --force "$container" >/dev/null 2>&1 || true
  done
}

trivy_in_cache() {
  docker run --rm --label "$fathom_scan_label" \
    --volume "$(clone_name fathom-trivy-cache)":/root/.cache/trivy "$@"
}

# Holds this copy's Trivy cache until release_trivy_cache, so a second scan in the same copy cannot
# update the database while this one reads it and records its results under its version. Fails,
# naming the process, while another holds it; a hold whose process has ended is taken over.
hold_trivy_cache() {
  local holder
  mkdir -p .tmp && chmod 700 .tmp
  if ! mkdir "$fathom_trivy_lock" 2>/dev/null; then
    holder="$(cat "$fathom_trivy_lock/process" 2>/dev/null || true)"
    if [ -z "$holder" ] || any_running "$holder"; then
      fail "Another scan in this copy${holder:+, process $holder,} is using Trivy's cache; run this again when it ends, or remove $fathom_trivy_lock if no scan is running"
    fi
    rm -rf "$fathom_trivy_lock"
    mkdir "$fathom_trivy_lock" || fail "Could not hold Trivy's cache"
  fi
  printf '%s\n' "$$" >"$fathom_trivy_lock/process"
}

release_trivy_cache() {
  if [ "$(cat "$fathom_trivy_lock/process" 2>/dev/null || true)" = "$$" ]; then
    rm -rf "$fathom_trivy_lock"
  fi
}

# Brings Trivy's vulnerability database in this copy's cache up to date, and prints when it was
# built, such as 2026-11-07T18:32:58Z. Scans after it skip updating it, so every scan of one report
# reads the same database, and an earlier result is reused only with the database it was judged by.
update_trivy_database() {
  trivy_in_cache "$fathom_trivy_image" image --download-db-only --quiet --skip-version-check \
    --disable-telemetry >&2 &&
    trivy_database
}

# Prints when the vulnerability database in this copy's cache was built, without updating it, or
# fails when the cache holds none.
trivy_database() {
  trivy_in_cache --network none "$fathom_trivy_image" version --format json |
    node scripts/trivy-facts.mjs database-version
}

# Fails, saying what can't be reached, unless this computer reaches the package registry, which the
# scans that need the internet use, so a check without a connection says so rather than failing in
# a scanner.
require_connection() {
  NODE_USE_ENV_PROXY=1 node scripts/offline.mjs online ||
    fail "This computer can't reach the internet, which some checks need. Run 'pnpm check --offline' or 'pnpm security --offline' to leave them out; the Check workflow runs them on the pull request"
}

# Scans the linux/amd64 build of an image for vulnerable packages and built-in secrets, writing
# Trivy's JSON report to standard output, with the database update_trivy_database last fetched. An
# earlier scan, from a report in output/security/, is reused when the image's configuration, which
# names every layer by its contents, the exceptions, the scan's arguments, Trivy, its database,
# given as $4, and the day all match; the day is part of it since an exception stops applying on
# the day it expires. This scan's inputs are recorded in the report folder, $3, for later reports.
# The image is saved to a file in the folder given, $2, which must be inside the repository, so
# Trivy is never given access to the container runtime. Overdue findings the Security Plan excepts,
# listed in .trivyignore.yaml, are left out until each exception expires. Saving fails if the image
# has no linux/amd64 build, so only what production runs is scanned. Fails when the scan does not
# complete. Run from the repository root.
scan_image() {
  local image="$1" folder="$2" report_dir="$3" database="$4" saved report config exceptions
  local status=0
  saved="$(mktemp "$folder/image.XXXXXX")" || return 1
  if ! report="$(mktemp "$folder/report.XXXXXX")"; then
    rm -f "$saved"
    return 1
  fi
  exceptions="$(git hash-object .trivyignore.yaml)" || exceptions=""
  if docker save --platform linux/amd64 --output "$saved" "$image" &&
    config="$(tar -xOf "$saved" manifest.json | node scripts/trivy-facts.mjs image-config)"; then
    local inputs=(
      "image-config=$config"
      "exceptions=$exceptions"
      "settings=${fathom_image_scan_arguments[*]}"
      "trivy=$fathom_trivy_image"
      "database=$database"
      "day=$(date -u +%Y-%m-%d)"
    )
    if node scripts/scan-reuse.mjs reuse-image "$report_dir" "$image" "${inputs[@]}" >"$report"; then
      info "Reused an earlier scan of $image, which has not changed" >&2
    elif trivy_in_cache --volume "$saved:/image.tar:ro" \
      --volume "$PWD/.trivyignore.yaml:/trivyignore.yaml:ro" "$fathom_trivy_image" \
      "${fathom_image_scan_arguments[@]}" >"$report"; then
      node scripts/scan-reuse.mjs record-image "$report_dir" "$image" "$report" "${inputs[@]}"
    else
      status=1
    fi
  else
    status=1
  fi
  [ "$status" -ne 0 ] || cat "$report"
  rm -f "$saved" "$report"
  return "$status"
}

# Runs Docker Compose for linux/amd64, with images tagged separately and named without a registry,
# so neither the development images built for this machine nor a release's are touched. Each copy of
# the repository tags and caches its own. The images are built without the release, commit and
# commit date Help's About box shows, which change nothing a scan finds, so an image whose sources
# have not changed is built the same, and its scan can be reused.
compose_for_scan() {
  DOCKER_DEFAULT_PLATFORM=linux/amd64 FATHOM_REGISTRY="" FATHOM_IMAGE_TAG="$(clone_name security-scan)" \
    FATHOM_VERSION="" FATHOM_COMMIT="" FATHOM_COMMIT_DATE="" docker compose "$@"
}

# Builds the images in deploy's Compose files for linux/amd64, and lists each image to scan in
# images.list in the folder given, or what could not be pulled, built or listed, which counts as not
# scanned, so a report can never pass on a partial or stale scan. Marks the list finished once
# every Compose file is done, so a build that stopped part way counts as not scanned too.
build_compose_images() {
  local images_dir="$1" compose_file images list="$1/images.list"
  mkdir -p "$images_dir"
  : >"$list"
  for compose_file in deploy/compose*.yaml deploy/compose*.yml; do
    [ -f "$compose_file" ] || continue
    # An image that could not be pulled may be stale, so it counts as not scanned.
    if ! compose_for_scan --file "$compose_file" --profile '*' pull --quiet --ignore-buildable; then
      info "Could not pull the images in $compose_file"
      printf 'missing|images pulled by %s\n' "$compose_file" >>"$list"
      continue
    fi
    if ! compose_for_scan --file "$compose_file" --profile '*' build --quiet; then
      info "Could not build the images in $compose_file"
      printf 'missing|images built by %s\n' "$compose_file" >>"$list"
      continue
    fi
    if ! images="$(compose_for_scan --file "$compose_file" --profile '*' config --images)"; then
      info "Could not list the images in $compose_file"
      printf 'missing|images listed by %s\n' "$compose_file" >>"$list"
      continue
    fi
    printf '%s\n' "$images" | sed -n 's/^\(..*\)$/image|\1/p' >>"$list"
  done
  : >"$images_dir/images.finished"
}

# Scans each image listed in images.list in the folder given, $1, once, however many services or
# Compose files name it, with Trivy's database $3, and writes the scans to container-images.json
# in the report folder, $2. An empty database, or a list never marked finished, counts as not
# scanned.
scan_compose_images() {
  local images_dir="$1" report_dir="$2" database="$3" kind name report index=0 scanned=" "
  local image_reports=()
  if [ ! -f "$images_dir/images.finished" ]; then
    info "The images were not all built, so not all of them were scanned"
    image_reports+=("images that were not all built=$images_dir/missing.json")
  fi
  while IFS='|' read -r kind name; do
    if [ "$kind" = missing ]; then
      image_reports+=("$name=$images_dir/missing.json")
      continue
    fi
    case "$scanned" in
      *" $name "*) continue ;;
    esac
    scanned="$scanned$name "
    index=$((index + 1))
    report="$images_dir/$index.json"
    if [ -z "$database" ] ||
      ! scan_image "$name" "$images_dir" "$report_dir" "$database" >"$report"; then
      info "The scan of $name did not complete"
      rm -f "$report"
    fi
    image_reports+=("$name=$report")
  done < <(cat "$images_dir/images.list" 2>/dev/null || true)
  node scripts/combine-image-reports.mjs ${image_reports[@]+"${image_reports[@]}"} \
    >"$report_dir/container-images.json"
}

# Finds when each fix the image scans in the report folder name was released, and summarizes them,
# failing if a fix is overdue or has no known release date, if a secret is built into an image, or
# if a scan did not complete. A fix first seen now, rather than by an earlier report, has no known
# release date, so it fails: a fresh machine, such as a hosted runner, would otherwise never find
# one overdue.
judge_image_scans() {
  local report_dir="$1" started
  started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  node scripts/fix-dates.mjs "$report_dir" || info "Could not find when the fixes were released"
  node scripts/security-summary.mjs "$report_dir" --first-seen-unknown-from "$started" \
    container-images.json
}

# Prints a repository's address as an https web address without credentials, such as
# https://example.com/owner/fathom for git@example.com:owner/fathom.git, so it can be published:
# any user name, password, query or fragment is left out.
# Fails for a folder on this machine, which has no web address.
fathom_https_url() {
  local url="$1" scheme="" host
  url="${url%%[?#]*}"
  url="${url%/}"
  url="${url%.git}"
  case "$url" in
    /* | file://* | "") return 1 ;;
    *://*)
      scheme="${url%%://*}"
      url="${url#*://}"
      ;;
    *:*) url="${url/://}" ;;
  esac
  host="${url%%/*}"
  url="${host##*@}${url#"$host"}"
  # An ssh address's port, such as host:2222, is not the web address's.
  case "$scheme" in
    ssh | git+ssh) url="${url%%[:/]*}/${url#*/}" ;;
  esac
  printf 'https://%s\n' "$url"
}

require_container_runtime() {
  command -v docker >/dev/null 2>&1 || fail "A container runtime is required; see docs/operations/supported-platforms.md"
  docker info >/dev/null 2>&1 || fail "The container runtime is installed but not running"
}

# The Check workflow must run every scan, so working offline is refused where CI is set.
refuse_offline_in_ci() {
  [ -z "${CI:-}" ] || fail "--offline leaves out scans the Check workflow must run, so it can't be used where CI is set"
}

# Builds this copy's database image for this machine, as development and the database tests run it,
# failing with the message given, or one for a build without the internet.
build_dev_database_image() {
  env -u DOCKER_DEFAULT_PLATFORM FATHOM_IMAGE_TAG="$(clone_name dev)" \
    docker compose --file deploy/compose.dev.yaml build --quiet ||
    fail "${1:-Could not build the database image. Without the internet, run 'pnpm offline:prepare' while connected, then work with --offline or FATHOM_OFFLINE=1}"
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

# Runs one of the server's account commands, such as apps/server/src/create-account.ts, against the
# development database, starting and migrating it first.
run_dev_account_command() {
  local command="$1"
  shift
  [ -s .dev/secrets/fathom_auth_secret ] || fail "Development secrets are missing; run 'pnpm dev:setup' first"
  bash scripts/dev-db.sh up
  bash scripts/dev-db.sh migrate
  FATHOM_PUBLIC_URL="https://localhost:$FATHOM_DEV_PORT" \
    FATHOM_AUTH_SECRET_FILE="$PWD/.dev/secrets/fathom_auth_secret" \
    FATHOM_DB_HOST=127.0.0.1 \
    FATHOM_DB_PORT="$FATHOM_DEV_DB_PORT" \
    FATHOM_DB_NAME=fathom \
    FATHOM_DB_USER=fathom_app \
    FATHOM_DB_PASSWORD_FILE="$PWD/.dev/secrets/fathom_app_password" \
    node "$command" "$@"
}
