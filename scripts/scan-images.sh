#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Scans Fathom's container images as a release's scan does, writing the scans and a summary to
# output/security/<time>/: the images in deploy's Compose files, built from the checked-out code
# for linux/amd64, and the images of the newest full release, leaving out pre-releases, pulled
# from the registry, since those are what people most likely run. With no release yet, it says so
# and scans the built images only; a release whose images cannot be pulled counts as not scanned.
# Fails if a vulnerability's fix is overdue or has no known release date, if a secret is built into
# an image, or if a scan does not complete. The daily scan runs it on the default branch.
# Usage: pnpm scan:images
#
# Settings:
#   FATHOM_REGISTRY  where releases are published; ghcr.io/jlarue26 unless set
# Sign in to the registry first if it needs it, such as with 'docker login ghcr.io'. Needs git,
# Node.js and a container runtime with Docker Compose.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

images_dir=""

cleanup() {
  stop_scan_containers
  if [ -n "$images_dir" ]; then rm -rf "$images_dir"; fi
  release_trivy_cache
}

# The newest full release tag, leaving out pre-releases, or nothing before the first release. A
# failure to read the tags fails, rather than reading as no release.
newest_release_tag() {
  local tags
  tags="$(git tag --list 'v*')" || fail "Could not read the release tags"
  printf '%s\n' "$tags" | node scripts/newest-release.mjs
}

# Adds the images release $1 published to images.list in the folder $2, pulled for linux/amd64, or
# what could not be listed or pulled, which counts as not scanned.
pull_release_images() {
  local tag="$1" folder="$2" registry="${FATHOM_REGISTRY:-ghcr.io/jlarue26}" image images
  local list="$folder/images.list" release="$folder/release"
  mkdir -p "$release/deploy"
  if ! git show "$tag:deploy/compose.yaml" >"$release/deploy/compose.yaml" ||
    ! images="$(docker compose --file "$release/deploy/compose.yaml" config --format json |
      node scripts/release-compose.mjs --images --registry "$registry" --version "${tag#v}")"; then
    info "Could not list the images of $tag"
    printf 'missing|images of %s\n' "$tag" >>"$list"
    return 0
  fi
  while IFS= read -r image; do
    [ -n "$image" ] || continue
    if docker pull --quiet --platform linux/amd64 "$image" >/dev/null; then
      printf 'image|%s\n' "$image" >>"$list"
    else
      info "Could not pull $image"
      printf 'missing|%s, which could not be pulled\n' "$image" >>"$list"
    fi
  done <<<"$images"
}

main() {
  require_git_repository
  require_container_runtime

  local report_dir database tag
  report_dir="$PWD/output/security/$(date -u +%Y-%m-%dT%H-%M-%SZ)"
  mkdir -p "$report_dir" .tmp && chmod 700 .tmp
  trap cleanup EXIT
  hold_trivy_cache
  images_dir="$(mktemp -d "$PWD/.tmp/images.XXXXXX")"

  info "Building the container images for the production server's processor"
  build_compose_images "$images_dir"
  tag="$(newest_release_tag)" || fail "Could not find the newest release"
  if [ -z "$tag" ]; then
    info "No release has been made yet, so only the built images are scanned"
  else
    info "Pulling the images of $tag, the newest full release"
    pull_release_images "$tag" "$images_dir"
  fi

  info "Scanning the container images"
  database="$(update_trivy_database)" || fail "Could not update Trivy's database, so the images were not scanned"
  scan_compose_images "$images_dir" "$report_dir" "$database"
  judge_image_scans "$report_dir"
}

main "$@"
