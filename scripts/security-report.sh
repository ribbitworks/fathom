#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Runs Fathom's security scans side by side, as the security plan requires, and writes each tool's
# results and a summary to output/security/<time>/: dependency vulnerabilities and licences, secrets
# in files and git history, code security flaws, configuration, and the container images in
# deploy's Compose files, built for the production server's processor. The images are built and
# scanned only when something that decides their scan changed against origin/main, as
# scripts/scan-inputs.mjs decides, or when that cannot be told. Trivy's scans of the dependencies
# and of each image reuse an earlier report's result when nothing they read has changed, as
# scripts/scan-reuse.mjs decides. The summary names each scan skipped or reused.
# Fails if a vulnerability's fix is overdue under the Security Plan's fix times, if any other scan
# finds a critical or high issue, or if a scan does not complete. Run by 'pnpm check'.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

gitleaks_image="zricethezav/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f"
semgrep_image="semgrep/semgrep:1.182.1@sha256:451b3d875c00dac7ed5db5293e584a07de11449a409c10b3c2d2652f429630b6"
# How the dependencies are scanned, all of which decides whether an earlier scan can be reused.
dependency_scan_arguments=(
  fs --quiet --skip-version-check --disable-telemetry --skip-db-update --include-dev-deps
  --scanners 'vuln,license' --ignorefile /trivyignore.yaml --format json --exit-code 0 /src
)
report_dir=""
scan_copy=""
images_dir=""

# Each scan writes its results to standard output, so the report files belong to the current
# user. A scan that does not complete is recorded by the summary instead of stopping the report.

scan_dependency_advisories() {
  pnpm audit --json >"$report_dir/dependencies.json" || true
}

scan_files_for_secrets() {
  docker run --rm --label "$fathom_scan_label" --network none --volume "$scan_copy:/src:ro" \
    "$gitleaks_image" \
    dir /src --no-banner --redact --log-level warn --exit-code 0 --report-format json --report-path - \
    >"$report_dir/secrets-files.json" || info "The scan of files for secrets did not complete"
}

scan_history_for_secrets() {
  # Mounts git's shared folder, which also works when this is a git worktree.
  local git_dir
  git_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
  docker run --rm --label "$fathom_scan_label" --network none --volume "$git_dir:/repo/.git:ro" \
    --env GIT_CONFIG_COUNT=1 --env GIT_CONFIG_KEY_0=safe.directory --env GIT_CONFIG_VALUE_0='*' \
    "$gitleaks_image" git /repo --no-banner --redact --log-level warn --exit-code 0 \
    --report-format json --report-path - \
    >"$report_dir/secrets-history.json" || info "The scan of git history for secrets did not complete"
}

scan_code() {
  # Semgrep gives up on a file after 5 seconds a rule by default, which large test files can reach
  # on a busy machine, such as while 'pnpm check' runs the tests beside it; any file left unscanned
  # fails the report, so it is given longer.
  docker run --rm --label "$fathom_scan_label" --volume "$scan_copy:/src:ro" --workdir /src \
    "$semgrep_image" \
    semgrep scan --config p/default --metrics=off --disable-version-check --quiet --json \
    --timeout 120 . \
    >"$report_dir/code.json" || info "The scan of code for security flaws did not complete"
}

# Prints a key input's value, or nothing if the command fails, so the scan is not reused.
input_value() {
  "$@" 2>/dev/null || true
}

# Trivy's scans run one after another, since they share a cache. The database version is kept for
# the image scans, which wait for the images to be built.
scan_with_trivy() {
  local database
  if ! database="$(update_trivy_database)"; then
    info "Could not update Trivy's database, so its scans of dependencies and images did not run"
    database=""
  fi
  printf '%s\n' "$database" >"$images_dir/database"
  [ -z "$database" ] || scan_dependencies "$database"

  info "Scanning configuration for misconfiguration"
  # Only the project's own files are scanned; configuration files inside dependencies are not ours.
  trivy_in_cache --volume "$scan_copy:/src:ro" "$fathom_trivy_image" \
    fs --quiet --skip-version-check --disable-telemetry \
    --scanners misconfig --format json --exit-code 0 /src \
    >"$report_dir/configuration.json" || info "The scan of configuration did not complete"
}

scan_dependencies() {
  local database="$1"
  local inputs=(
    "dependency-files=$(input_value node scripts/scan-inputs.mjs dependency-hash "$scan_copy")"
    "installed=$(input_value git hash-object node_modules/.pnpm/lock.yaml)"
    "exceptions=$(input_value git hash-object .trivyignore.yaml)"
    "settings=${dependency_scan_arguments[*]}"
    "trivy=$fathom_trivy_image"
    "database=$database"
    "day=$(date -u +%Y-%m-%d)"
  )
  if node scripts/scan-reuse.mjs reuse "$report_dir" files.json "${inputs[@]}"; then
    info "Reused an earlier scan of dependencies and licences, which have not changed"
    return 0
  fi
  info "Scanning dependencies for vulnerabilities and licences"
  # Trivy also reads installed packages, read-only, to find their licences. Overdue findings the
  # Security Plan excepts, listed in .trivyignore.yaml, are left out until each exception expires.
  if trivy_in_cache --volume "$scan_copy:/src:ro" --volume "$PWD/node_modules:/src/node_modules:ro" \
    --volume "$PWD/.trivyignore.yaml:/trivyignore.yaml:ro" "$fathom_trivy_image" \
    "${dependency_scan_arguments[@]}" >"$report_dir/files.json"; then
    node scripts/scan-reuse.mjs record "$report_dir" files.json "${inputs[@]}"
  else
    info "The scan of dependencies for vulnerabilities did not complete"
  fi
}

main() {
  require_git_repository
  require_container_runtime

  report_dir="$PWD/output/security/$(date -u +%Y-%m-%dT%H-%M-%SZ)"
  mkdir -p "$report_dir"
  # Stops any scan still running, such as after an interruption, with its containers and the copies
  # it reads.
  trap 'kill $(jobs -p) 2>/dev/null || true; stop_scan_containers; rm -rf "$scan_copy" "$images_dir"; release_trivy_cache' EXIT
  hold_trivy_cache
  scan_copy="$(make_scan_copy)"
  mkdir -p "$scan_copy/node_modules"
  images_dir="$(mktemp -d "$PWD/.tmp/images.XXXXXX")"

  # The images are scanned only when something that decides their scan changed on this branch, or
  # when that cannot be told; main's images are scanned daily and at every release.
  local scan_images=true changed
  if ! changed="$(node scripts/scan-inputs.mjs image-scan)"; then
    info "Could not tell whether anything that decides the container images' scan changed, so they are scanned"
  elif [ "$changed" = unchanged ]; then
    scan_images=false
    node scripts/scan-reuse.mjs record-skip "$report_dir" container-images.json
    info "Nothing that decides the container images' scan changed, so they are not built or scanned"
  else
    info "The container images are scanned, since these changed: $(printf '%s' "$changed" | tr '\n' ' ')"
  fi

  info "Scanning dependencies, secrets, code, configuration and container images side by side"
  local others=() builder="" trivy pid
  scan_dependency_advisories &
  others+=($!)
  scan_files_for_secrets &
  others+=($!)
  scan_history_for_secrets &
  others+=($!)
  scan_code &
  others+=($!)
  if [ "$scan_images" = true ]; then
    build_compose_images "$images_dir" &
    builder=$!
  fi
  scan_with_trivy &
  trivy=$!

  # Each scan records its own failure, so how a scan's process ended changes nothing here.
  wait "$trivy" || true
  if [ "$scan_images" = true ]; then
    wait "$builder" || true
    info "Scanning container images for the production server's processor"
    scan_compose_images "$images_dir" "$report_dir" "$(cat "$images_dir/database" 2>/dev/null || true)"
  fi
  for pid in "${others[@]}"; do wait "$pid" || true; done

  info "Finding when each fix was released"
  node scripts/fix-dates.mjs "$report_dir" || info "Could not find when the fixes were released"

  node scripts/security-summary.mjs "$report_dir"
}

main "$@"
