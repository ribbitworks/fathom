#!/usr/bin/env bash
# Runs Fathom's security scans and writes a report to output/security/<time>/.
# Fails if any scan finds a critical or high issue, or does not complete.
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
docker run --rm --volume "$scan_copy:/src:ro" --workdir /src "$semgrep_image" \
  semgrep scan --config p/default --metrics=off --disable-version-check --quiet --json . \
  >"$report_dir/code.json" || info "The scan of code for security flaws did not complete"

info "Scanning files for vulnerabilities, misconfiguration, and licences"
# Trivy also reads installed packages, read-only, to find their licences.
docker run --rm --volume "$scan_copy:/src:ro" --volume "$PWD/node_modules:/src/node_modules:ro" \
  --volume fathom-trivy-cache:/root/.cache/trivy "$trivy_image" \
  fs --quiet --skip-version-check --disable-telemetry --include-dev-deps \
  --scanners vuln,misconfig,license --format json --exit-code 0 /src \
  >"$report_dir/files.json" || info "The scan of files for vulnerabilities did not complete"

node scripts/security-summary.mjs "$report_dir"
