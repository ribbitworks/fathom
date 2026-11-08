# Fathom — Development Setup

**Status:** Proposal for the owner's review
**Last updated:** 2026-11-07

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
  seed/                   Fictional data and development accounts
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
- **Development-only packages:** `fixtures`, `seed`, and `test-utils` are never included in the runtime image, and the server never depends on them, which `scripts/runtime-image.test.mjs` checks. The server's `package.json` exports its account and sign-in code only for the development-only `seed` package, which creates and deactivates the development accounts through it; that code checks no permissions, so the server's own routes call it only after checking them. It also exports its access rules and data access layer, through which `seed` makes its drafts as the personas, with their permissions checked as for anyone.
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
- **Production-like mode:** The containers in the [Architecture](architecture.md) run with Docker Compose, over HTTPS, with the same network isolation as production, at `https://localhost:9443`, or the port of the copy's clone number below, so development mode can run alongside. Images are built for linux/amd64, so on machines with a different processor they run under emulation, more slowly. Tests of the running containers run in this mode, with throwaway secrets.
- **Tests and the database:** Development mode and the database tests build images for the machine's own processor, so they run at full speed. The security report scans separate linux/amd64 builds, so what is scanned is what production runs.
- **Version and build:** The scripts read the release, the commit and the commit's date from git in `scripts/lib.sh`, for Help's About box, and pass them to the image build as build arguments, since the build cannot see `.git`. The commit is marked as modified, and the date taken, as the [Decisions Log](../product/decisions.md#platform-and-operations) sets out. Development mode reads them when `pnpm dev` starts, so it names that commit even once the code changes. Setting `FATHOM_VERSION`, `FATHOM_COMMIT` or `FATHOM_COMMIT_DATE` overrides them, as when building from a copy without `.git`.
- **Several copies at once:** Each copy of the repository on one machine can run both modes and their tests alongside the others when it is given its own clone number, from 1 to 9, with `pnpm dev:setup <number>`. The number is kept in the git-ignored `.dev/clone`, and clone 1 is the default. In development mode, the top bar and the browser tab's title show the clone number, and the top bar the branch, read when `pnpm dev` starts. Each copy gets its own database and database image, containers, production-like and scanned images, and scanner cache, and these ports, where n is the clone number:

  | Port | Clone 1 | Clone n |
  | --- | --- | --- |
  | Development mode | 8443 | 8443 + 10 × (n - 1) |
  | Development server's API | 8444 | 8444 + 10 × (n - 1) |
  | Development database | 5432 | 5432 + (n - 1) |
  | Production-like mode | 9443 | 9443 + 10 × (n - 1) |

  Browsers keep cookies apart by host but not by port, so Fathom names its sign-in cookie after the port when its address has one. Each copy and mode then keeps its own sign-in, and one browser can stay signed in to all of them at once.

  Copying `.dev/` from another copy keeps the same development accounts' password in every copy, but also copies its clone number, so run `pnpm dev:setup <number>` straight after with the new copy's own number. Until then, the new copy uses the other's database, and `pnpm dev:reset` there would delete it.

### HTTPS

Both modes use a locally trusted certificate created with mkcert and stored in the git-ignored `.dev/` folder. mkcert's local certificate authority key stays in mkcert's own folder and is never shared or copied into the repository. Node.js-based tools that call Fathom over HTTPS are pointed at the local certificate authority with `NODE_EXTRA_CA_CERTS`. Production uses the internal certificate described in the [IT Overview](../operations/it-overview.md).

### Secrets and Configuration

- **Development secrets:** A setup script generates development-only values, such as database passwords, into the git-ignored `.dev/` folder, which is added to `.gitignore` with the first code. Production secrets are never placed on development machines.
- **Example configuration:** `deploy/fathom.env.example` lists every setting with placeholder values, and a test keeps it in step with the settings the code reads.
- **Database roles:** The development database is initialized with the same separate migration and application roles as production, and integration tests connect as the application role, so missing permissions show up in tests.

### Common Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev:setup [clone number]` | Create development secrets, such as random database passwords and the session secret, and the locally trusted HTTPS certificate in the private `.dev/` folder. A clone number from 1 to 9 lets this copy run alongside others, as [Ways to Run Fathom](#ways-to-run-fathom) describes |
| `pnpm account:create --name <name> --email <email> [--role <role>]` | Create an account in the development database, printing once the password Fathom generates for it, which its user changes at first sign-in. It holds the Team Member role unless `--role` names another starting role, named as in [Roles](../product/roles.md) in lowercase with hyphens, such as `workforce-administrator` |
| `pnpm admin:create --email <email>` | Create the Fathom Administrator account in the development database, holding the Administrator role, printing once the password Fathom generates for it, which is changed at first sign-in. It changes nothing once any account holds the Administrator role |
| `pnpm db:up` and `pnpm db:down` | Start and stop the development database, whose port is published only on this machine |
| `pnpm dev` | Start development mode: the database, with migrations applied, the server, and the front end, and open Fathom at `https://localhost:8443`, or the clone's port, in the browser. The server and the front end reload when their code changes. It first stops this clone's server and front end if they are still running, wherever they were started, so running it again restarts them; if another program or another clone holds one of the ports, it fails with the process's name and stops nothing. Ctrl+C stops them; the database keeps running until `pnpm db:down` |
| `pnpm dev:stop` | Stop this clone's server and front end, wherever they were started, leaving the database running |
| `pnpm build` | Build the front end into `apps/web/dist`, which the server serves when `FATHOM_WEB_ROOT` points to it |
| `pnpm db:migrate` | Apply migration files using the migration role |
| `pnpm db:reset` | Delete and recreate the development database, and apply migrations |
| `pnpm db:seed` and `pnpm db:unseed` | Add the fictional data to the development database, unless it is there already, and remove it again. Seeding also adds the [development accounts](#development-accounts) and prints the password they share. Removing first discards every draft of a seeded person or seeded planned hire, and of a planned hire drafted under a seeded manager, those made by hand included, since it removes the records they change, then keeps anything added by hand, a seeded column or list that something added by hand still uses, live or in a draft, and a seeded person whom a planned hire added by hand reports to or was filled by, and says so. It deactivates the accounts rather than deleting them, since the change history refers to accounts, and seeding again reactivates them |
| `pnpm db:seed:accounts` | Add only the [development accounts](#development-accounts) to the development database, with no fictional data, and print the password they share, as after `pnpm db:reset`, to try Fathom as an organization starts |
| `pnpm dev:reset` | Delete and recreate the development database, add the fictional data and the [development accounts](#development-accounts), print the accounts' password, and start development mode |
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
| `pnpm stack:create-account --name <name> --email <email> [--role <role>]` and `pnpm stack:create-administrator --email <email>` | Create an account, or the Fathom Administrator account, in production-like mode while it runs, as `pnpm account:create` and `pnpm admin:create` do |
| `pnpm test:containers` | Container tests, in a separate copy of production-like mode: users reach Fathom only through the proxy, and the application and database cannot reach the internet |
| `pnpm test:ui` | UI tests |

## Fictional Seed Data

- **Generator:** `packages/fixtures` uses Faker with a fixed seed, and dates everything from a reference date, the day the seed data is added in Fathom's time zone, so it produces the same data, with the same identifiers, on every run on a given day, and on any day looks as it does on any other: the same people still to start, current, and gone, release streams with a release that has shipped, one under way, and one to come, and planned hires and drafts ahead, and `packages/seed` writes it to the database, recorded in the change history as made by Fathom itself.
- **Contents so far:** Lists of sites, levels, and roles on the team, the People columns that draw on them, an Onboarding Note column, General, holding fictional onboarding checklists for the eight newest starters still employed, two still to start and six further along the earlier they started, the positions in the built-in Positions list, lists of certifications and languages that no column draws on, people, each with a position, current and former, with a few who start after the reference date, each with a current reporting line except the person at the top, who has no manager, and a manager who has left with reports still under them, and names for about half the managers' teams, the first six of them coloured teal, grape, orange, indigo, yellow, and pink, and the rest uncoloured, the other teams unnamed, drafts made through the data access layer as the personas would make them: the Engineering Operations Manager drafts adding two people, changing three, one of them a Restricted end date, moving Simone Jean from Viktoria Holmberg, who has left, to Silje Holm-Schrøder at the top, naming 本間 稔's team Observability team, and removing one, and a second Engineering Operations Manager changes another of one person's details, so one draft holds two people's changes; for lists, the first drafts adding a Skills list with two choices, renaming a site, adding Harbourside to Sites and moving it to the top, removing a position no one holds, retiring a role on the team, removing the Certifications list and retiring Languages, which no column draws on, moving the Co-op level and the Engineering Manager position, and a new description for Positions, and the second describes the renamed site, renames Roles on the team, and sends the rejected Sites order for approval again, so it waits on Harbourside, still rejected; for People's columns, the first drafts adding a Previous site column, renaming Level to Grade, which the second makes required, removing Role on team, and moving Level before Site, then adding a Skills column drawing on the new Skills list, and giving Silje Holm-Schrøder Rust in it, so her draft uses the drafts of the list, the column, and the choice; and the Engineering Director rejects two of the drafts of people, Harbourside, the Sites and Positions orders, the Positions description, and the Previous site column, each with a reason; each persona publishes their drafts before anyone else changes or decides them, so all of these are published; then changes left unpublished, which only their maker sees and which hold their records for everyone else: the Engineering Operations Manager's change to Mariana Metz's site and their new Equipment list with a Laptop choice, and the second Engineering Operations Manager's change to the position in Viktoria Holmberg's published draft, which others see held by the Second Engineering Operations Manager; eight planned hires, recorded as made by Fathom itself: six not yet filled, in both hiring states, three named Backend engineer 1, Backend engineer 2, and Payments tester and three unnamed, with the requisitions REQ-2041, REQ-2042, and REQ-2047 or a temporary ID, two with no manager and one with no target date, and two filled, REQ-2036 by someone who starts after the reference date and REQ-2031 by a current person who moved to it from another team, with a site, a level, or both for four of those not yet filled, and their person's values for the two filled; the Engineering Operations Manager drafts and publishes moving Backend engineer 1 from Request to hire to Approved to hire, adding REQ-2050, and clearing Payments tester's target date, which the Engineering Director rejects; two live release streams, Platform, in quarters from three quarters before the current one and in halves from three quarters after it, with the releases Harbor 1, which has shipped, Harbor 2, ending this quarter, and Harbor 3, to come, and Patches, in four-week cycles from eight weeks before this week's Monday, with two releases named Patch and the month each ships in, one shipped and one under way; and an account for each persona in the [Product Brief](../product/brief.md#users), named after it, with its persona's role from [Roles](../product/roles.md#roles-by-persona). Each later slice adds its own data, until the seed holds feature teams and leads, products, customers, projects, features, allocations, and estimates, covering every role and every level of protected data.
- **Realistic but invented:** Names and details are generated, mostly Canadian names, in English and French, then names from India, where the organization also works, and a few from elsewhere: some with accented letters, such as French, German, Spanish, Swedish, and Danish names, and some in other scripts, such as Korean, Japanese, Chinese, and Russian. Every screen and search is tried with them, and the data looks realistic without describing anyone real. No real company, customer, or product names are used.
- **Sizes:** About 150 people for development and demonstrations, and smaller sets for tests.
- **Shared building blocks:** `packages/fixtures` holds the building blocks for fictional records, used by both the generator and tests.
- **Never derived from real data:** As required by the [Data](../../AGENTS.md#data) rules.

### Development Accounts

Seeding adds these accounts: one for each persona in the [Product Brief](../product/brief.md#users), holding its persona's role from [Roles](../product/roles.md#starting-roles); a second Engineering Operations Manager, so the seed data has drafts that two people changed; a Resource Planner, which sees people without their Restricted details, as [Roles](../product/roles.md#what-each-role-can-do) sets out; and a Superuser, for trying a feature without changing accounts. The Superuser holds a Superuser role that grants every permission, which seeding makes if it is missing; it is not a starting role, so a Fathom set up without the seed data does not have it. They share a random password, kept in `.dev/secrets/dev_account_password` so it stays the same between resets, which `pnpm db:seed` prints, and, unlike accounts given a password Fathom generates, they need not change it at first sign-in. An account already there keeps its password, so if that file is replaced, run `pnpm dev:reset` to give every account the new one.

| Account | Name | Role |
| --- | --- | --- |
| `product.manager@fathom.test` | Product Manager | Product Manager |
| `project.manager@fathom.test` | Project Manager | Project Manager |
| `engineering.manager@fathom.test` | Engineering Manager | Engineering Manager |
| `feature.lead@fathom.test` | Feature Lead | Feature Lead |
| `engineering.director@fathom.test` | Engineering Director | Engineering Director |
| `engineering.operations.manager@fathom.test` | Engineering Operations Manager | Workforce Administrator |
| `engineering.operations.manager.2@fathom.test` | Second Engineering Operations Manager | Workforce Administrator |
| `executive@fathom.test` | Executive | Executive |
| `team.member@fathom.test` | Team Member | Team Member |
| `resource.planner@fathom.test` | Resource Planner | Resource Planner |
| `fathom.administrator@fathom.test` | Fathom Administrator | Administrator |
| `superuser@fathom.test` | Superuser | Superuser |
