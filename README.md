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

Create development secrets and the local HTTPS certificate, then start development mode:

```bash
pnpm dev:setup
pnpm dev
```

Fathom is then at <https://localhost:8443>. Until the first page is added, open <https://localhost:8443/api/greeting> to see the server read its greeting from the database.

Check everything, including the tests and the security report:

```bash
pnpm check
```

See [Development Setup](docs/design/development-setup.md#common-commands) for what each command does, including how to stop development mode.

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
