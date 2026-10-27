#!/usr/bin/env bash
# Checks every shell script with ShellCheck, run as a container without network access.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

shellcheck_image="koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d"

require_git_repository
files="$(list_project_files '*.sh')"
[ -n "$files" ] || exit 0
require_container_runtime

scan_copy="$(make_scan_copy)"
trap 'rm -rf "$scan_copy"' EXIT

scripts=()
while IFS= read -r file; do
  scripts+=("$file")
done <<<"$files"

docker run --rm --network none --volume "$scan_copy:/mnt:ro" --workdir /mnt "$shellcheck_image" \
  --external-sources "${scripts[@]}"
