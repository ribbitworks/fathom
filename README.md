# Fathom

Fathom plans software work over time: what a team will build, who will build it, and when.

## Features

- **Roadmap:** features grouped into releases on release streams, shown on a timeline and a board.
- **Resource planning:** who is assigned to which feature or project, for which months, and how much of their time, as people join and leave and teams change.
- **Capacity:** whether the people planned can do the work planned, month by month, including planned hires.
- **Drafts:** changes are drafts until they're approved, and can be compared with what's live.
- **Access control:** data is classified as General, Personal or Confidential, and each role sees and changes only the classifications its permissions allow.

## Security

The [Security Plan](docs/security/security-plan.md) sets out what Fathom guards against, [How Data Is Safeguarded](docs/privacy/data-protection.md) who sees which data, and [Securing Your Environment](docs/operations/securing-your-environment.md) what whoever runs Fathom must secure.

## Status

Early development. Fathom isn't ready for production use, and it isn't accepting outside contributions yet: see [Contributing](CONTRIBUTING.md). Report a vulnerability privately, as the [Security Policy](SECURITY.md) sets out.

The tech stack is recorded in [ADR 0001](docs/adr/0001-tech-stack.md), and Fathom is being built slice by slice, as described in the [Implementation Plan](docs/design/implementation-plan.md).

## Getting Started

You need a running container runtime, such as [Docker Engine](https://docs.docker.com/engine/install/), [Colima](https://github.com/abiosoft/colima#installation) or [Podman](https://podman.io/docs/installation), and [mkcert](https://github.com/FiloSottile/mkcert#installation). [Supported Platforms](docs/operations/supported-platforms.md#development-platforms) lists the runtimes used for development. Then run the bootstrap script, which installs everything else:

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
.github/    GitHub workflows that publish and scan images, and the forms for filing issues
docs/       Documentation, standards, and decision records
LICENSES/   Licence texts, as the REUSE specification requires
```

## Releases

Releases are made by hand with the project's scripts, which prepare the changelog and tag, and build, scan, and publish the container images, so they work wherever the repository is hosted. See [Development Setup](docs/design/development-setup.md#releases) for the steps.

## Supported Platforms

Fathom runs as Linux containers. See [Supported Platforms](docs/operations/supported-platforms.md) for where it is tested and supported.

## Licence

Copyright 2026 Jared La Rue. Licensed under the [Apache License, Version 2.0](LICENSE). The [Code of Conduct](CODE_OF_CONDUCT.md) is the Contributor Covenant, under [CC BY 4.0](LICENSES/CC-BY-4.0.txt).
