#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Checks that every file states its copyright and licence, following the REUSE specification, with
# the REUSE tool run as a container without network access on a copy of the project's files. Run by
# 'pnpm check'.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

reuse_image="fsfe/reuse:6.3.0@sha256:2748d04c2adeb747c9a44831bc99a9cbfd7bf7ff6fc371a4b63204944e3e47b6"

require_git_repository
require_container_runtime

scan_copy="$(make_scan_copy)"
trap 'rm -rf "$scan_copy"' EXIT

docker run --rm --network none --volume "$scan_copy:/data:ro" "$reuse_image" lint --lines
