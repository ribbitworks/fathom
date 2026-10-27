# Fathom

Fathom is a tool for high-level software project planning, resource assignment, and roadmapping.

## Status

Early development. The tech stack is recorded in [ADR 0001](docs/adr/0001-tech-stack.md); the first code, Hello Fathom, is being built as described in the [Implementation Plan](docs/design/implementation-plan.md).

## Getting Started

You need a running container runtime and mkcert. Then run the bootstrap script, which installs everything else:

```bash
bash scripts/dev-bootstrap.sh
```

On Windows, run `scripts/dev-bootstrap.ps1` in PowerShell instead.

Check everything, including the tests and the security report:

```bash
pnpm check
```

See [Development Setup](docs/design/development-setup.md) for all commands and details.

## Repository Layout

```text
apps/       Applications (front end and server)
packages/   Shared packages
scripts/    Automation scripts
docs/       Documentation, standards, and decision records
```

## Supported Platforms

Fathom runs as Linux containers. See [Supported Platforms](docs/operations/supported-platforms.md) for where it is tested and supported.

## License

Copyright 2026 Jared La Rue. Licensed under the [Apache License, Version 2.0](LICENSE).
