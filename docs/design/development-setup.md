# Fathom — Development Setup

**Status:** Proposal for the owner's review
**Last updated:** 2026-10-31

How Fathom's repository is organized, how developers run it locally, and how fictional data is generated. It applies the libraries in [ADR 0002](../adr/0002-libraries.md) and the platforms in [Supported Platforms](../operations/supported-platforms.md).

## Repository Layout

The repository is a pnpm workspace:

```text
apps/
  web/                    React front end, built with Vite
  server/                 Fastify API server, which also serves the built front end
packages/
  shared/                 Zod schemas, shared types, and constants used by both apps
  db/                     Drizzle schema, migration files, and the migration runner
  fixtures/               Building blocks for fictional records, used by seed and tests
  seed/                   Fictional data generator
  test-utils/             Test data factories and test helpers
deploy/
  compose.yaml            Production container setup, also run on development machines
  compose.dev.yaml        The development database
  compose.env.example     The host settings compose.yaml reads
  fathom.env.example      The application's settings
  docker/                 Container image definitions and database initialization
scripts/                  Development and check scripts
docs/                     Documentation
LICENSES/                 Licence texts, as the REUSE specification requires
```

- **Data access layer:** Lives in `apps/server/src/data/`, so every read of protected data goes through the server's tier checks. `packages/db` holds the schema, the migrations, and the database client. A lint rule allows only the data access layer, the server's start-up code, the account command, `seed`, `test-utils`, the server's test helper, and tests to import it; other code may use only its types.
- **Shared code:** Only `packages/shared` is used by both the front end and the server, so server-only code never reaches the browser.
- **Development-only packages:** `fixtures`, `seed`, and `test-utils` are never included in the runtime image.
- **Root configuration:** The workspace definition, shared TypeScript, linting, and formatting settings, the pinned Node.js and pnpm versions, and the Renovate configuration.

## Local Development

Developers may use any machine and container runtime listed for development in Supported Platforms, as long as their use of it needs no paid licence. Development may happen on machines not managed by IT, using fictional data only.

### Prerequisites

- **A container runtime:** One listed for development in Supported Platforms, installed and running.
- **mkcert:** For the local HTTPS certificate.
- **Bootstrap script:** `bash scripts/dev-bootstrap.sh` on macOS and Linux, or `scripts/dev-bootstrap.ps1` on Windows, installs everything else: fnm, the Node.js version pinned in `.node-version`, the pnpm version pinned in `package.json`, and the project's dependencies. It is safe to run again at any time. Add `--configure-shell`, or `-ConfigureShell` on Windows, to also add fnm to your shell profile.
- **Check tools:** The scanners the [Security Plan](../security/security-plan.md) requires run as containers, with images pinned by digest, so nothing extra is installed. Image scans read an exported image file rather than being given access to the container runtime.
- **Ignored files:** Every tool reads `.gitignore`. ShellCheck, PSScriptAnalyzer, the REUSE tool, Gitleaks, Semgrep, and Trivy run in containers that see only a copy of the files git would track, made under the git-ignored `.tmp/` folder, so ignored folders such as `private/` are never read. Trivy also reads `node_modules`, read-only, to find package licences, and the scan of git history sees only git's own folder. ESLint, Prettier, markdownlint, and `pnpm audit` run directly on the machine.
- **Windows:** If PowerShell blocks the bootstrap script, allow local scripts with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. `pnpm check` runs bash scripts, so it needs Git Bash or WSL.
- **Downloads during checks:** Most scanners run without network access. Semgrep downloads its rules, Trivy its vulnerability database, `pnpm audit` queries the package registry, and the PowerShell linter downloads PSScriptAnalyzer once and checks its hash.

### Ways to Run Fathom

- **Development mode:** PostgreSQL runs in a container, and the server and front end run directly on the machine with automatic reloading. The front end's development server forwards API requests to the server, so the browser sees one HTTPS origin. It does not send the server's security headers, so the built front end is also tested to need no inline scripts, which those headers block.
- **Production-like mode:** The containers in the [Architecture](architecture.md) run with Docker Compose, over HTTPS, with the same network isolation as production, at `https://localhost:9443` so development mode can run alongside. Images are built for linux/amd64, so on machines with a different processor they run under emulation, more slowly. Tests of the running containers run in this mode, with throwaway secrets.
- **Tests and the database:** Development mode and the database tests build images for the machine's own processor, so they run at full speed. The security report scans separate linux/amd64 builds, so what is scanned is what production runs.

### HTTPS

Both modes use a locally trusted certificate created with mkcert and stored in the git-ignored `.dev/` folder. mkcert's local certificate authority key stays in mkcert's own folder and is never shared or copied into the repository. Node.js-based tools that call Fathom over HTTPS are pointed at the local certificate authority with `NODE_EXTRA_CA_CERTS`. Production uses the internal certificate described in the [IT Overview](../operations/it-overview.md).

### Secrets and Configuration

- **Development secrets:** A setup script generates development-only values, such as database passwords, into the git-ignored `.dev/` folder, which is added to `.gitignore` with the first code. Production secrets are never placed on development machines.
- **Example configuration:** `deploy/fathom.env.example` lists every setting with placeholder values, and a test keeps it in step with the settings the code reads.
- **Database roles:** The development database is initialized with the same separate migration and application roles as production, and integration tests connect as the application role, so missing permissions show up in tests.

### Common Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev:setup` | Create development secrets, such as random database passwords and the session secret, and the locally trusted HTTPS certificate in the private `.dev/` folder |
| `pnpm account:create --name <name> --email <email> [--role <role>]... [--no-viewer]` | Create an account in the development database, asking for its password without showing it. It is a Viewer unless `--no-viewer` is given, with any other roles named as in [Roles](../product/roles.md) in lowercase with hyphens, such as `workforce-administrator` |
| `pnpm db:up` and `pnpm db:down` | Start and stop the development database, whose port is published only on this machine |
| `pnpm dev` | Start development mode: the database, with migrations applied, the server, and the front end, and open Fathom at `https://localhost:8443` in the browser. The server and the front end reload when their code changes. Ctrl+C stops them; the database keeps running until `pnpm db:down` |
| `pnpm build` | Build the front end into `apps/web/dist`, which the server serves when `FATHOM_WEB_ROOT` points to it |
| `pnpm db:migrate` | Apply migration files using the migration role |
| `pnpm db:reset` | Delete and recreate the development database, and apply migrations |
| `pnpm db:seed` and `pnpm db:unseed` | Add the fictional data to the development database, unless it is there already, and remove it again. Removing keeps anything added by hand, and a seeded column or list that something added by hand still uses, and says so |
| `pnpm dev:reset` | Delete and recreate the development database, create an account for "Your Name" (`you@example.test`) as Administrator and Workforce Administrator, print its password, and start development mode. The password is random and kept in `.dev/secrets/dev_account_password`, so it stays the same between resets |
| `pnpm typecheck` | Check types across the workspace |
| `pnpm check` | The single command from the [Testing Standards](../standards/testing.md#running-tests) |
| `pnpm test` | All tests, including database tests that run against a throwaway PostgreSQL container |
| `pnpm security` | The security report, written to a dated folder under the git-ignored `output/security/` folder |
| `pnpm lint`, `pnpm lint:md`, `pnpm lint:shell`, `pnpm lint:powershell`, `pnpm lint:licences` | Individual linters, also run by `pnpm check` |
| `pnpm format` | Format source files |
| `pnpm updates` | List available dependency updates with Renovate, written to the git-ignored `output/updates/` folder; changes nothing, and needs network access to the package and container registries |
| `pnpm update:analyzer <version>` | Pin a new PSScriptAnalyzer version together with its SHA-256 |
| `pnpm reset-caches` | Remove cached scanner data, which is rebuilt on the next check |
| `pnpm prune-reports [days]` | Delete local reports older than the given number of days, 365 by default. Security reports are always kept for at least one calendar year, and must also be kept in the location agreed with IT, as the [Security Plan](../security/security-plan.md) requires |
| `pnpm stack:up`, `pnpm stack:down`, `pnpm stack:reset`, and `pnpm stack:logs` | Start, stop, delete the data of, and follow the logs of production-like mode |
| `pnpm stack:create-account --name <name> --email <email> [--role <role>]... [--no-viewer]` | Create an account in production-like mode while it runs, asking for its password without showing it |
| `pnpm test:containers` | Container tests, in a separate copy of production-like mode: users reach Fathom only through the proxy, and the application and database cannot reach the internet |
| `pnpm test:ui` | UI tests |

## Fictional Seed Data

- **Generator:** `packages/fixtures` uses Faker with a fixed seed and a fixed reference date, so it produces the same data, with the same identifiers, on every run, and `packages/seed` writes it to the database, recorded in the change history as made by Fathom itself.
- **Contents so far:** Lists of sites, positions, levels, and roles on the team, the People columns that draw on them, and people, current and former, with a few who start after the reference date. Each later slice adds its own data, until the seed holds teams and managers, feature teams and leads, projects, features, cycles, releases, allocations, estimates, and planned hires, covering every role and every level of protected data.
- **Realistic but invented:** Names and details are generated, including names from the countries the organization works in, so the data looks realistic without describing anyone real. No real company, customer, or product names are used.
- **Sizes:** About 150 people for development and demonstrations, and smaller sets for tests.
- **Shared building blocks:** `packages/fixtures` holds the building blocks for fictional records, used by both the generator and tests.
- **Never derived from real data:** As required by the [Data](../../AGENTS.md#data) rules.
