# Fathom — Supported Platforms

**Status:** Draft
**Last updated:** 2026-10-26

Fathom runs as Linux containers for the x86-64 architecture (linux/amd64), managed with Docker Compose. Any host that can run those containers can in principle run Fathom. This document lists the platforms Fathom is tested on and supported on, and what each needs.

A platform is listed as supported only after Fathom's test suite has passed on it.

## Server Platforms

| Platform | Container runtime | Status |
| --- | --- | --- |
| Windows Server with WSL 2 | Docker Engine with Compose, inside WSL 2 | Planned |
| Linux on x86-64 | Docker Engine with Compose | Planned |
| Windows Server with Docker Desktop | Docker Desktop | Not supported (see [ADR 0001](../adr/0001-tech-stack.md)) |

### Windows Server with WSL 2

Running Fathom on Windows Server with WSL 2 needs this setup:

- **Start-up:** WSL and Docker do not start at boot by default, so the host needs a start-up task, with systemd enabled in the Linux distribution.
- **Networking:** WSL 2 uses NAT networking by default, so users cannot reach Fathom until port forwarding or mirrored networking is configured.
- **Storage:** The database and backup staging folders live on the Linux filesystem, not the Windows drive, for performance and file permissions.

## Development Platforms

| Platform | Container runtime | Status |
| --- | --- | --- |
| macOS | Docker Desktop, which needs a paid subscription for larger companies | In use for development; not yet tested, since there is no code yet |
| macOS, Linux, or Windows | A container runtime without a paid licence, such as Docker Engine, Colima, or Podman | Planned |

Container files must not depend on features of a particular container runtime, and images must be built for linux/amd64 even on machines with a different processor.

## Browsers

Which browsers and versions are supported is to be decided.
