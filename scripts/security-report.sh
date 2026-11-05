#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Runs Fathom's security scans, as the security plan requires, and writes each tool's results and a
# summary to output/security/<time>/: dependency vulnerabilities and licences, secrets in files and
# git history, code security flaws, configuration, and the container images in deploy's Compose
# files, built for the production server's processor.
# Fails if any scan finds a critical or high issue, or does not complete. Run by 'pnpm check'.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

gitleaks_image="zricethezav/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f"
semgrep_image="semgrep/semgrep:1.182.1@sha256:451b3d875c00dac7ed5db5293e584a07de11449a409c10b3c2d2652f429630b6"
trivy_image="aquasec/trivy:0.76.1@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c"

require_git_repository
require_container_runtime

report_dir="$PWD/output/security/$(date -u +%Y-%m-%dT%H-%M-%SZ)"
mkdir -p "$report_dir"

scan_copy="$(make_scan_copy)"
trap 'rm -rf "$scan_copy"' EXIT
mkdir -p "$scan_copy/node_modules"

# Each scan writes its results to standard output, so the report files belong to the current
# user. A scan that does not complete is recorded by the summary instead of stopping the report.

info "Scanning dependencies"
pnpm audit --json >"$report_dir/dependencies.json" || true

info "Scanning files for secrets"
docker run --rm --network none --volume "$scan_copy:/src:ro" "$gitleaks_image" \
  dir /src --no-banner --redact --log-level warn --exit-code 0 --report-format json --report-path - \
  >"$report_dir/secrets-files.json" || info "The scan of files for secrets did not complete"

info "Scanning git history for secrets"
# Mounts git's shared folder, which also works when this is a git worktree.
git_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
docker run --rm --network none --volume "$git_dir:/repo/.git:ro" \
  --env GIT_CONFIG_COUNT=1 --env GIT_CONFIG_KEY_0=safe.directory --env GIT_CONFIG_VALUE_0='*' \
  "$gitleaks_image" git /repo --no-banner --redact --log-level warn --exit-code 0 \
  --report-format json --report-path - \
  >"$report_dir/secrets-history.json" || info "The scan of git history for secrets did not complete"

info "Scanning code for security flaws"
# Semgrep gives up on a file after 5 seconds a rule by default, which large test files can reach on
# a busy machine; any file left unscanned fails the report, so it is given longer.
docker run --rm --volume "$scan_copy:/src:ro" --workdir /src "$semgrep_image" \
  semgrep scan --config p/default --metrics=off --disable-version-check --quiet --json \
  --timeout 30 . \
  >"$report_dir/code.json" || info "The scan of code for security flaws did not complete"

info "Scanning dependencies for vulnerabilities and licences"
# Trivy also reads installed packages, read-only, to find their licences.
docker run --rm --volume "$scan_copy:/src:ro" --volume "$PWD/node_modules:/src/node_modules:ro" \
  --volume "$(clone_name fathom-trivy-cache)":/root/.cache/trivy "$trivy_image" \
  fs --quiet --skip-version-check --disable-telemetry --include-dev-deps \
  --scanners vuln,license --format json --exit-code 0 /src \
  >"$report_dir/files.json" || info "The scan of dependencies for vulnerabilities did not complete"

info "Scanning configuration for misconfiguration"
# Only the project's own files are scanned; configuration files inside dependencies are not ours.
docker run --rm --volume "$scan_copy:/src:ro" \
  --volume "$(clone_name fathom-trivy-cache)":/root/.cache/trivy "$trivy_image" \
  fs --quiet --skip-version-check --disable-telemetry \
  --scanners misconfig --format json --exit-code 0 /src \
  >"$report_dir/configuration.json" || info "The scan of configuration did not complete"

info "Building and scanning container images for the production server's processor"
# Runs Docker Compose for linux/amd64, with images tagged separately, so the development images
# built for this machine are untouched. Each copy of the repository tags and caches its own.
compose_for_scan() {
  DOCKER_DEFAULT_PLATFORM=linux/amd64 FATHOM_IMAGE_TAG="$(clone_name security-scan)" docker compose "$@"
}
# Each image is saved to a file that Trivy reads, so Trivy is never given access to the container
# runtime. Findings the Security Plan excepts, listed in .trivyignore.yaml, are left out until each
# exception expires. Every image is passed to the summary, and anything that fails is recorded as
# not scanned, so the report can never pass on a partial or stale scan.
images_dir="$(mktemp -d "$PWD/.tmp/images.XXXXXX")"
trap 'rm -rf "$scan_copy" "$images_dir"' EXIT
image_reports=()
index=0
for compose_file in deploy/compose*.yaml deploy/compose*.yml; do
  [ -f "$compose_file" ] || continue
  # An image that could not be pulled may be stale, so it counts as not scanned.
  if ! compose_for_scan --file "$compose_file" --profile '*' pull --quiet --ignore-buildable; then
    info "Could not pull the images in $compose_file"
    image_reports+=("images pulled by $compose_file=$images_dir/missing.json")
    continue
  fi
  if ! compose_for_scan --file "$compose_file" --profile '*' build --quiet; then
    info "Could not build the images in $compose_file"
    image_reports+=("images built by $compose_file=$images_dir/missing.json")
    continue
  fi
  if ! images="$(compose_for_scan --file "$compose_file" --profile '*' config --images)"; then
    info "Could not list the images in $compose_file"
    image_reports+=("images listed by $compose_file=$images_dir/missing.json")
    continue
  fi
  while IFS= read -r image; do
    [ -n "$image" ] || continue
    index=$((index + 1))
    report="$images_dir/$index.json"
    # Saving fails if the image has no linux/amd64 build, so only what production runs is scanned.
    if ! docker save --platform linux/amd64 --output "$images_dir/$index.tar" "$image" ||
      ! docker run --rm --volume "$images_dir/$index.tar:/image.tar:ro" \
        --volume "$PWD/.trivyignore.yaml:/trivyignore.yaml:ro" \
        --volume "$(clone_name fathom-trivy-cache)":/root/.cache/trivy "$trivy_image" \
        image --quiet --skip-version-check --disable-telemetry --scanners vuln,secret \
        --ignorefile /trivyignore.yaml --format json --exit-code 0 --input /image.tar >"$report"; then
      info "The scan of $image did not complete"
      rm -f "$report"
    fi
    image_reports+=("$image=$report")
  done <<<"$images"
done
node scripts/combine-image-reports.mjs ${image_reports[@]+"${image_reports[@]}"} >"$report_dir/container-images.json"

node scripts/security-summary.mjs "$report_dir"
