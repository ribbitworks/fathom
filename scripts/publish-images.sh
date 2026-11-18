#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# Builds, scans and publishes the container images of one release.
# Usage: pnpm publish:images [--dry-run] vX.Y.Z
#
# Builds the images in deploy/compose.yaml for linux/amd64 from a clean copy of exactly the release
# tag, each labelled with its source, licence, version and commit, and dated by the commit rather
# than the build. Scans each image as the security report does, reusing an earlier scan of an image
# that has not changed, failing if a fix is overdue or has no known release date, then pushes each
# as <registry>/<name>:<version>, such as ghcr.io/ribbitworks/fathom-app:0.1.0. --dry-run does
# everything but push, and prints what it would.
#
# Settings:
#   FATHOM_REGISTRY    where the images go; ghcr.io/ribbitworks unless set
#   FATHOM_SOURCE_URL  the source code's web address the images name; the origin remote's unless set
# Sign in to the registry first, such as with 'docker login ghcr.io'. Needs git, Node.js and a
# container runtime with Docker Compose.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

work=""
copy=""

# Removes the tag's copy and the build's files, whatever happens.
cleanup() {
  if [ -n "$copy" ]; then git worktree remove --force "$copy" >/dev/null 2>&1 || true; fi
  if [ -n "$work" ]; then rm -rf "$work"; fi
  git worktree prune
  stop_scan_containers
  release_trivy_cache
}

usage() { fail "Usage: pnpm publish:images [--dry-run] vX.Y.Z"; }

# Writes a Compose file for the release: the tag's own deploy/compose.yaml as Compose resolves it,
# with the release, commit and commit date Help's About box shows, rewritten by
# scripts/release-compose.mjs to name, label and date each image.
release_compose_file() {
  local copy="$1" output="$2"
  FATHOM_VERSION="$version" FATHOM_COMMIT="$(git rev-parse --short "$revision")" \
    FATHOM_COMMIT_DATE="$(git log -1 --format=%cs "$revision")" \
    docker compose --file "$copy/deploy/compose.yaml" config --format json |
    node scripts/release-compose.mjs --registry "$registry" --version "$version" \
      --revision "$revision" --epoch "$(git log -1 --format=%ct "$revision")" \
      --created "$(git log -1 --format=%cI "$revision")" --source "$source" >"$output"
}

main() {
  local dry_run=false tag=""
  [ "${1:-}" != "--" ] || shift
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --dry-run) dry_run=true ;;
      -*) usage ;;
      *)
        [ -z "$tag" ] || usage
        tag="$1"
        ;;
    esac
    shift
  done
  [ -n "$tag" ] || usage
  fathom_is_release_tag "$tag" || fail "$tag is not a release tag, such as v0.1.0"

  require_git_repository
  local revision
  revision="$(git rev-parse --verify --quiet "refs/tags/$tag^{commit}")" ||
    fail "There is no tag $tag; make the release with 'pnpm release' first, or fetch its tag"

  local source
  source="$(fathom_https_url "${FATHOM_SOURCE_URL:-$(git remote get-url origin 2>/dev/null)}")" ||
    fail "The source code has no web address; set FATHOM_SOURCE_URL to it"
  require_container_runtime

  local registry="${FATHOM_REGISTRY:-ghcr.io/ribbitworks}"
  local version="${tag#v}"

  mkdir -p .tmp && chmod 700 .tmp
  work="$(mktemp -d "$PWD/.tmp/release.XXXXXX")"
  copy="$work/source"
  trap cleanup EXIT
  hold_trivy_cache
  info "Checking out $tag"
  git worktree add --quiet --detach "$copy" "$revision"

  info "Building the images of $tag for linux/amd64"
  local compose_file="$work/compose.json"
  release_compose_file "$copy" "$compose_file"
  DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose --file "$compose_file" build --quiet

  local images=()
  local image
  while IFS= read -r image; do
    [ -n "$image" ] && images+=("$image")
  done < <(docker compose --file "$compose_file" config --images | sort -u)
  [ "${#images[@]}" -gt 0 ] || fail "The release builds no images"

  info "Scanning the images"
  local report_dir
  report_dir="$PWD/output/security/$(date -u +%Y-%m-%dT%H-%M-%SZ)"
  mkdir -p "$report_dir"
  local database
  database="$(update_trivy_database)" || fail "Could not update Trivy's database, so the images were not scanned"
  printf 'image|%s\n' "${images[@]}" >"$work/images.list"
  : >"$work/images.finished"
  scan_compose_images "$work" "$report_dir" "$database"
  judge_image_scans "$report_dir" >/dev/null ||
    fail "The images of $tag failed their scan; see $report_dir/summary.md"
  info "The images passed their scan; see $report_dir/summary.md"

  for image in "${images[@]}"; do
    if [ "$dry_run" = true ]; then
      info "Would push $image"
    else
      info "Pushing $image"
      docker push --quiet "$image" >/dev/null
    fi
  done
}

main "$@"
