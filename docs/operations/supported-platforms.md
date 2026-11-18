# Fathom: Supported Platforms

**Last updated:** 2026-11-17

Fathom runs as Linux containers for x86-64 (linux/amd64), managed with Docker Compose. Its container files don't depend on any one container runtime.

## Server Platforms

Fathom has no release yet, so no host is supported for production use. Once it has, these are:

- **A Linux host:** any host that runs Docker Engine with Compose for linux/amd64, including a Linux virtual machine, such as one under Hyper-V on Windows Server.
- **Windows 11 with WSL2:** Windows 11 22H2 or later, running Docker Engine with Compose inside a WSL2 Linux distro, with WSL2's mirrored networking. [Securing Your Environment](securing-your-environment.md#on-windows-11-with-wsl2) sets out what such a host must secure.
- **Not supported:**
  - WSL2 on Windows Server. Windows Server has only WSL2's NAT networking, whose port proxy hides each user's address, so sign-in limits, sessions and request logs would see one address for everyone. Run Fathom in a Linux virtual machine instead.
  - Docker Desktop on Windows Server, as [ADR 0001](../adr/0001-tech-stack.md) sets out.

[Architecture](../design/architecture.md#where-fathom-runs) shows how each runs Fathom's containers.

## Development Platforms

- **Operating systems:** macOS, Linux, or Windows with WSL2, as [Development Setup](../design/development-setup.md#developing-on-windows) sets out. Fathom is developed on macOS.
- **Container runtimes:** Docker Engine, Colima, Podman or Docker Desktop.
- **Processors:** Release images are built for linux/amd64; [Development Setup](../design/development-setup.md#ways-to-run-fathom) describes which development builds use the machine's own processor.

## Browsers

Chrome, Edge, Safari and Firefox, and browsers built on them, such as Brave or Arc. Saving an export opens the browser's Save dialog where the browser offers one, as Chrome, Edge and others built on Chromium do; Safari and Firefox save it as their own download settings say.
