#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Updates the pinned PSScriptAnalyzer version and its SHA-256 in lint-powershell.sh.
# Usage: scripts/update-script-analyzer.sh <version>

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

version="${1:-}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Usage: scripts/update-script-analyzer.sh <version>, such as 1.25.0"

# The download address serves the latest version when the requested one does not exist, so the
# exact version is confirmed first.
curl --fail --silent --show-error --location --retry 4 --output /dev/null \
  "https://www.powershellgallery.com/api/v2/Packages(Id='PSScriptAnalyzer',Version='$version')" ||
  fail "PSScriptAnalyzer $version was not found in the PowerShell Gallery"

package="$(mktemp)"
trap 'rm -f "$package"' EXIT
info "Downloading PSScriptAnalyzer $version"
curl --fail --silent --show-error --location --retry 4 \
  --output "$package" "https://www.powershellgallery.com/api/v2/package/psscriptanalyzer/$version" ||
  fail "Could not download PSScriptAnalyzer $version"

if command -v sha256sum >/dev/null 2>&1; then
  sha256="$(sha256sum "$package" | cut -d' ' -f1)"
else
  sha256="$(shasum -a 256 "$package" | cut -d' ' -f1)"
fi

lint_script="scripts/lint-powershell.sh"
sed -i.bak \
  -e "s/^analyzer_version=\"[^\"]*\"/analyzer_version=\"$version\"/" \
  -e "s/^analyzer_sha256=\"[^\"]*\"/analyzer_sha256=\"$sha256\"/" \
  "$lint_script"
if ! grep -qx "analyzer_version=\"$version\"" "$lint_script" || ! grep -qx "analyzer_sha256=\"$sha256\"" "$lint_script"; then
  mv "$lint_script.bak" "$lint_script"
  fail "Could not find the analyzer version and hash lines in $lint_script; nothing was changed"
fi
rm -f "$lint_script.bak"

info "Pinned PSScriptAnalyzer $version with SHA-256 $sha256"
info "Run 'pnpm lint:powershell' to install and check it"
