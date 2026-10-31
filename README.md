# Fathom

Fathom is a tool for high-level software project planning, resource assignment, and roadmapping.

## Status

Early development. The tech stack is recorded in [ADR 0001](docs/adr/0001-tech-stack.md), and Fathom is being built slice by slice, as described in the [Implementation Plan](docs/design/implementation-plan.md).

## Getting Started

You need a running container runtime and mkcert. Then run the bootstrap script, which installs everything else:

```bash
bash scripts/dev-bootstrap.sh
```

On Windows, run `scripts/dev-bootstrap.ps1` in PowerShell instead.

Create development secrets and the local HTTPS certificate, create an account for yourself, then start development mode:

```bash
pnpm dev:setup
pnpm account:create --name "Your Name" --email you@example.test
pnpm dev
```

`pnpm dev` opens Fathom in your browser, where you sign in with that account. It can view Fathom's general information; to give it other roles, such as administrator, see [Development Setup](docs/design/development-setup.md#common-commands).

To fill Fathom with fictional people to work with, run `pnpm db:seed`; `pnpm db:unseed` removes them again.

Check everything, including the tests and the security report:

```bash
pnpm check
```

See [Development Setup](docs/design/development-setup.md#common-commands) for what each command does, including how to stop development mode.

## Repository Layout

```text
apps/       Applications (front end and server)
packages/   Shared packages
deploy/     Deployment configuration
scripts/    Automation scripts
docs/       Documentation, standards, and decision records
LICENSES/   Licence texts, as the REUSE specification requires
```

## Supported Platforms

Fathom runs as Linux containers. See [Supported Platforms](docs/operations/supported-platforms.md) for where it is tested and supported.

## License

Copyright 2026 Jared La Rue. Licensed under the [Apache License, Version 2.0](LICENSE).
