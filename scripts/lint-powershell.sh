#!/usr/bin/env bash
# Checks every PowerShell script with PSScriptAnalyzer, run as a container.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

powershell_image="mcr.microsoft.com/powershell:7.5-ubuntu-24.04@sha256:042240d57ec9e47e511033b92625a8d95875ee5860af3015992c248b58a8be81"
analyzer_version="1.25.0"
analyzer_sha256="14e634c828eb98efb9f40b2918ba90f139ed5eccdf663a2a747736d996995d60"
modules_volume="fathom-powershell-modules"

require_git_repository
files="$(list_project_files '*.ps1' '*.psm1')"
[ -n "$files" ] || exit 0
require_container_runtime

# Installs the pinned analyzer into a cached volume after checking its hash. This step needs the
# network, so it is given only the install script, never the repository.
docker run --rm --platform linux/amd64 \
  --volume "$PWD/scripts/install-script-analyzer.ps1:/install-script-analyzer.ps1:ro" \
  --volume "$modules_volume:/modules" "$powershell_image" \
  pwsh -NoProfile -File /install-script-analyzer.ps1 \
  -Version "$analyzer_version" -Sha256 "$analyzer_sha256" -ModulesPath /modules

scan_copy="$(make_scan_copy)"
trap 'rm -rf "$scan_copy"' EXIT

scripts=()
while IFS= read -r file; do
  scripts+=("$file")
done <<<"$files"

docker run --rm --platform linux/amd64 --network none \
  --volume "$scan_copy:/mnt:ro" --volume "$modules_volume:/root/.local/share/powershell/Modules:ro" \
  --workdir /mnt "$powershell_image" \
  pwsh -NoProfile -File scripts/invoke-script-analyzer.ps1 -AnalyzerVersion "$analyzer_version" "${scripts[@]}"
