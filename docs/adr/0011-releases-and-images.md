# Releases and Container Images

- **ADR:** 0011
- **Status:** Accepted
- **Date:** 2026-11-07
- **Revised:** 2026-11-07, to add the daily scan of the default branch's and the newest full release's images to what moving the repository needs

## Context

Fathom runs as containers built from the repository, as [ADR 0001](0001-tech-stack.md) and [ADR 0003](0003-edge-proxy.md) set out. A release must reach the server as images that can be matched to their source, scanned as the [Security Plan](../security/security-plan.md) requires, with no overdue fix. Fathom is open source, and the repository may be hosted somewhere other than where it is today, so releasing must not depend on one hosting service.

## Options

- **A hosting service's release tool:** A service such as GitHub's own release automation tags releases, writes the changelog, and builds the images. Little code of Fathom's own, but the process works only on that service, and moving the repository means building it again.
- **Building on the server:** The server checks out a tag and builds its own images. No registry is needed, but the server needs the source, build tools, and network access to fetch packages, and each installation builds and scans for itself.
- **Project scripts and a registry:** Scripts in the repository tag a release and build, scan, and publish its images to a container registry, run by hand on any machine. A hosting service's automation, where there is one, only runs the same scripts.

## Decision

Fathom releases with project scripts and a registry:

- **`pnpm release`** picks the version and adds the changelog on a `release/vX.Y.Z` branch, which reaches the default branch through a pull request like any change; **`pnpm release:tag`** then tags the merge, on a maintainer's machine.
- **`pnpm publish:images`** builds the application, database, and proxy images from a clean copy of exactly the tag, labels them with their source, licence, version, and commit, scans them as the security report does, and publishes them only if none of their fixes is overdue or has no known release date.
- **The registry** is a setting, so the images can go to any registry; where they go by default, and how each step is run, is in [Development Setup](../design/development-setup.md#releases).
- **On GitHub,** a workflow run by hand runs `pnpm publish:images` with the workflow's own token. It makes no tags or releases.

## Consequences

- **Releasing works wherever the code is hosted,** and moving the repository changes only the registry setting and, at most, the thin workflows that run the scripts: the one that publishes a release's images, and the daily scan of the default branch's and the newest release's images, which needs that host's scheduler.
- **The server needs no source or build tools;** it pulls published images. How they reach a server with no route to the registry is part of the [Security Plan's](../security/security-plan.md#open-questions) open build-process question.
- **Each image names its source and commit,** so what runs can be matched to the code it was built from. The commit date fixes each image's labels and dates, not its digest: each build takes the security fixes released by that day, and installed files keep their build times, so repeatable images are later work, recorded in [issue #434](https://github.com/jlarue26/fathom/issues/434).
- **Releases are started by a person,** never on every merge, so a release is always a deliberate step.
