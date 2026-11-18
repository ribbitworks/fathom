# Fathom

Fathom plans software work over time: what a team will build, who will build it, and when. It keeps features, releases, projects, people, teams and the hiring plan in one place, for the people who plan and staff that work.

## Documentation

- [Product Brief](docs/product/brief.md) and [Roadmap](docs/product/roadmap.md): what Fathom is for, and what comes next
- [Help](docs/help/index.md): how to use each page of Fathom
- [Development Setup](docs/design/development-setup.md): how to set up, run, test and release Fathom
- [Architecture](docs/design/architecture.md): Fathom's parts and how they connect
- [How Fathom Is Built](docs/how-fathom-is-built.md): how AI agents build Fathom under the maintainer's review, and how its quality is checked
- [Security Plan](docs/security/security-plan.md), [How Data Is Safeguarded](docs/privacy/data-protection.md) and [Securing Your Environment](docs/operations/securing-your-environment.md): what Fathom guards against, who sees which data, and what whoever runs Fathom must secure
- [Contributing](CONTRIBUTING.md) and [Security Policy](SECURITY.md): how issues come in, and how to report a vulnerability

## Quick Start

With a container runtime and mkcert installed, as [Development Setup § Prerequisites](docs/design/development-setup.md#prerequisites) sets out:

```bash
git clone https://github.com/ribbitworks/fathom.git
cd fathom
bash scripts/dev-bootstrap.sh
pnpm dev:setup
pnpm dev:reset
```

`pnpm dev:reset` starts Fathom with fictional data, prints the development accounts' password, and opens Fathom in your browser. [Development Setup](docs/design/development-setup.md) covers Windows, the other commands, and running the tests.

## Licence

Copyright 2026 Jared La Rue. Licensed under the [Apache License, Version 2.0](LICENSE). The [Code of Conduct](CODE_OF_CONDUCT.md) is the Contributor Covenant, under [CC BY 4.0](LICENSES/CC-BY-4.0.txt).
