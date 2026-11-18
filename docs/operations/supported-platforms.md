# Fathom: Supported Platforms

**Last updated:** 2026-11-17

Fathom runs as Linux containers for x86-64 (linux/amd64), managed with Docker Compose. Its container files don't depend on any one container runtime.

## Server Platforms

- **Docker Engine with Compose:** Fathom runs on any host that runs Docker Engine with Compose for linux/amd64. It has no release yet, so no host is supported for production use.
- **Not supported:** Docker Desktop on Windows Server, as [ADR 0001](../adr/0001-tech-stack.md) sets out.

## Development Platforms

- **Operating systems:** macOS, Linux or Windows. Fathom is developed on macOS; the Windows bootstrap script hasn't been run on Windows yet.
- **Container runtimes:** Docker Engine, Colima, Podman or Docker Desktop.
- **Processors:** Release images are built for linux/amd64; [Development Setup](../design/development-setup.md#ways-to-run-fathom) describes which development builds use the machine's own processor.

## Browsers

Chrome, Edge, Safari and Firefox, and browsers built on them, such as Brave or Arc. Saving an export opens the browser's Save dialog where the browser offers one, as Chrome, Edge and others built on Chromium do; Safari and Firefox save it as their own download settings say.
