#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Checks that every file states its copyright and licence, following the REUSE specification, with
# the REUSE tool run as a container without network access on a copy of the project's files. Run by
# 'pnpm check'.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

reuse_image="fsfe/reuse:6.2.0@sha256:85462a75c0f8efda09ddd190b92816b70e7662577c8427429e11e1b9f25a992e"

require_git_repository
require_container_runtime

scan_copy="$(make_scan_copy)"
trap 'rm -rf "$scan_copy"' EXIT

docker run --rm --network none --volume "$scan_copy:/data:ro" "$reuse_image" lint --lines
