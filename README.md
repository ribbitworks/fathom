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

Create development secrets and the local HTTPS certificate, then start development mode with a fresh database, filled with fictional people and an account for each kind of user:

```bash
pnpm dev:setup
pnpm dev:reset
```

`pnpm dev:reset` prints the accounts' password and opens Fathom in your browser, where you sign in with any of the [development accounts](docs/design/development-setup.md#development-accounts). After that, `pnpm dev` starts development mode again, keeping the data.

To start again from a fresh database with the fictional data and accounts, deleting everything in the development database, including changes made by hand, stop development mode with Ctrl+C, then run:

```bash
pnpm dev:reset
```

`pnpm db:reseed` removes the fictional data from the development database and adds it again. `pnpm db:seed` and `pnpm db:unseed` do each half; removing deactivates the accounts. See [Development Setup](docs/design/development-setup.md#common-commands) for these and other commands.

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
.github/    GitHub workflows that publish a release's images and scan images daily
docs/       Documentation, standards, and decision records
LICENSES/   Licence texts, as the REUSE specification requires
```

## Releases

Releases are made by hand with the project's scripts, which prepare the changelog and tag, and build, scan, and publish the container images, so they work wherever the repository is hosted. See [Development Setup](docs/design/development-setup.md#releases) for the steps.

## Supported Platforms

Fathom runs as Linux containers. See [Supported Platforms](docs/operations/supported-platforms.md) for where it is tested and supported.

## License

Copyright 2026 Jared La Rue. Licensed under the [Apache License, Version 2.0](LICENSE).
