# Fathom: Development Setup

**Last updated:** 2026-11-18

How the repository is organized, how to run Fathom on your machine, its fictional data, how releases are made, and the repository's settings on GitHub.

- The libraries are chosen in [ADR 0002](../adr/0002-libraries.md), and the platforms listed in [Supported Platforms](../operations/supported-platforms.md).

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
scripts/                  Development, check, and release scripts
.github/actions/setup/    The setup the Check workflow's check and test jobs share: pnpm, Node.js and the dependencies
.github/workflows/        The workflows that run the full check and the container tests, draft a release for each tag, publish a release's images, and scan images daily on GitHub
.github/release.yml       How a release's generated notes are grouped
.github/ISSUE_TEMPLATE/   The forms for filing issues on GitHub, one for each kind
docs/                     Documentation, with the Help pages in docs/help/, which the front end builds in
LICENSES/                 Licence texts, as the REUSE specification requires
```

- **Data access layer:** `apps/server/src/data/`. Every read of protected data goes through its tier checks.
  - `packages/db` holds the schema, the migrations and the database client.
  - A lint rule lets only these import `packages/db`: the data access layer, the server's start-up code, the account command, `seed`, `test-utils`, the server's test helper, and tests. Other code may use only its types.
- **Shared code:** Only `packages/shared` is used by both the front end and the server, so server-only code never reaches the browser.
- **Development-only packages:** `fixtures`, `seed` and `test-utils` never reach the runtime image, and the server never depends on them. `scripts/runtime-image.test.mjs` checks this.
  - The server exports its account and sign-in code only for `seed`, which creates and deactivates the development accounts with it. That code checks no permissions, so the server's own routes call it only after checking them.
  - The server also exports its access rules and data access layer. `seed` makes its drafts through them as the personas, with their permissions checked as anyone's are.
- **Root configuration:** the workspace, the shared TypeScript, linting and formatting settings, the pinned Node.js and pnpm versions, and the Renovate settings.

## Local Development

Fathom is developed on the machines and container runtimes that [Supported Platforms](../operations/supported-platforms.md#development-platforms) lists. Development uses fictional data only.

### Prerequisites

- **On Windows, WSL2** with a Linux distro, set up as [Developing on Windows](#developing-on-windows) sets out. Everything below then runs inside the distro.
- **A container runtime,** installed and running. On Windows, Docker Engine inside the distro.
- **mkcert,** for the local HTTPS certificate.
- **Homebrew or fnm,** so the bootstrap script can install Node.js.

### First Run

1. Clone the repository and open a terminal in it.
1. Run `bash scripts/dev-bootstrap.sh`.
   - It installs fnm unless it's already there, then the Node.js version in `.node-version`, the pnpm version in `package.json`, and the dependencies.
   - It's safe to run again at any time.
   - Add `--configure-shell` to add fnm to your shell profile.
1. Run `pnpm dev:setup` to create the development secrets and the HTTPS certificate. mkcert may ask for your password the first time.
1. Run `pnpm dev:reset` to create the database with the [fictional data](#fictional-data) and start Fathom.

Fathom opens at `https://localhost:8443`. Sign in with any of the [development accounts](#development-accounts), using the password `pnpm dev:reset` printed.

- Ctrl+C stops Fathom.
- `pnpm dev` starts it again, keeping the data.

### Developing on Windows

Fathom is developed on Windows inside WSL2, with the same scripts as on Linux.

1. In a terminal opened as administrator, run `wsl --install`, then restart. It installs WSL2 and Ubuntu.
1. Inside the distro, install Docker Engine, following Docker's instructions for the distro, not Docker Desktop. WSL2 runs it with systemd.
1. Clone the repository into the distro's own files, such as under your home folder, not under `/mnt/c`, where files are much slower.
1. Follow [First Run](#first-run) inside the distro.
1. So Windows browsers trust the local certificate, copy `rootCA.pem` from the folder `mkcert -CAROOT` prints to Windows, and add it to your trusted certificates with `certutil -addstore -user Root rootCA.pem`.

Fathom then opens at `https://localhost:8443` in a Windows browser, since WSL2 passes `localhost` through to the distro.

### Ways to Run Fathom

- **Development mode,** with `pnpm dev`:
  - PostgreSQL runs in a container. The server and front end run on the machine and reload when their code changes.
  - The front end's development server passes API requests to the server, so the browser sees one HTTPS address.
  - That development server doesn't send the server's security headers, so a test checks that the built front end needs no inline scripts, which those headers block.
- **Production-like mode,** with `pnpm stack:up`:
  - The containers in the [Architecture](architecture.md) run with Docker Compose, over HTTPS, with the same network isolation as production.
  - It runs at `https://localhost:9443`, or the port for the copy's clone number, so development mode can run beside it.
  - Its images are built for linux/amd64, so on a machine with another processor they run more slowly, under emulation.
  - The container tests run in this mode, with throwaway secrets.
- **Images for tests:** Development mode and the database tests build images for the machine's own processor, so they run at full speed. The security report scans separate linux/amd64 builds, so it scans what production runs.

### Version and Build

- **The version** is the nearest release tag in the commit's history, such as `v0.3.0`, so a release is made by tagging it and no file keeps a copy that could fall out of step.
  - A release tag is a semantic version, with or without a pre-release such as `-rc.1`, and without build metadata. When several mark one commit, the highest is used.
  - A build past a release names how many commits past it it is; a build before the first release is Unreleased.
  - Every package keeps the version 0.0.0.
- `scripts/lib.sh` reads the release, the commit and the commit's date from git, for Help's [About box](visual-design.md#layout).
- The commit's date is its committer's clock, not the day of the build, so building one commit always gives the same image.
- The image build can't see `.git`, so the scripts pass these in as build arguments.
- When the files differ from the commit, it's shown with `-modified` after it, since the commit alone wouldn't say what is running.
- Development mode reads them when `pnpm dev` starts, so it keeps naming that commit as the code changes.
- `FATHOM_VERSION`, `FATHOM_COMMIT` and `FATHOM_COMMIT_DATE` override them, such as when building from a copy without `.git`.

### Several Copies on One Machine

Each copy of the repository can run both modes and their tests beside the others once it has its own clone number, from 1 to 9.

- Give a copy its number with `pnpm dev:setup <number>`. It's kept in the git-ignored `.dev/clone`.
- A copy with a number, 1 included, carries it in its names, such as `fathom-dev-1` and `fathom-stack-1`.
- A single copy with no number keeps the plain names, `fathom-dev` and `fathom-stack`, and clone 1's ports.
- In development mode, the top bar and the browser tab's title show the clone number, and the top bar shows the branch `pnpm dev` started on.
- Each copy has its own database and database image, containers, images, scanner cache, and these ports:

| Clone | Development mode | Development server's API | Development database | Production-like mode |
| --- | --- | --- | --- | --- |
| 1 | 8443 | 8444 | 5432 | 9443 |
| 2 | 8453 | 8454 | 5433 | 9453 |
| 3 | 8463 | 8464 | 5434 | 9463 |
| 4 | 8473 | 8474 | 5435 | 9473 |
| 5 | 8483 | 8484 | 5436 | 9483 |
| 6 | 8493 | 8494 | 5437 | 9493 |
| 7 | 8503 | 8504 | 5438 | 9503 |
| 8 | 8513 | 8514 | 5439 | 9513 |
| 9 | 8523 | 8524 | 5440 | 9523 |

Each clone number adds 10 to the clone before it, or 1 for the development database.

**Signing in to several copies:** Browsers keep cookies apart by host but not by port, so Fathom names its sign-in cookie after the port. Each copy and mode keeps its own sign-in, and one browser can stay signed in to all of them.

#### Setting Up Another Copy

1. Clone the repository into a folder of its own, and run the bootstrap script there, as in [First Run](#first-run).
1. In the new copy's folder, set `other` to the folder of a copy already set up, and `number` to the new copy's clone number, then paste:

   ```bash
   other=../fathom
   number=2
   mkdir -p .dev
   cp -R "${other}/.dev/." .dev/
   pnpm dev:setup "${number}"
   pnpm dev:reset
   ```

- Copying `.dev/` keeps the same development accounts' password in every copy.
- It also copies the other copy's clone number, so run `pnpm dev:setup <number>` straight after. Until then the new copy uses the other's database, and `pnpm dev:reset` would delete it.
- `pnpm dev:setup` prints the copy's address, such as `https://localhost:8453` for clone 2.

#### Giving a Number to a Copy That Had None

The copy gets new names, and so a new, empty database.

- Run `pnpm dev:reset` to create and seed it. Nothing carries over from the old one.
- The old database and scanner cache stay on the machine. The old containers keep clone 1's ports while they run.
- To remove the old containers and database: `docker compose --project-name fathom-dev --file deploy/compose.dev.yaml down --volumes`.
- To remove the old cache: `docker volume rm fathom-trivy-cache`.

### HTTPS

- Both modes use a certificate made with mkcert and kept in the git-ignored `.dev/` folder.
- mkcert's certificate authority key stays in mkcert's own folder. It's never shared or copied into the repository.
- Node.js tools that call Fathom over HTTPS trust it through `NODE_EXTRA_CA_CERTS`.
- Production uses a certificate from whoever runs Fathom, as [Securing Your Environment](../operations/securing-your-environment.md#certificates-and-secrets) sets out.

### Secrets and Configuration

- **Development secrets:** `pnpm dev:setup` generates them, such as database passwords, into the git-ignored `.dev/` folder. Production secrets never go on development machines.
- **Example configuration:** `deploy/fathom.env.example` lists every setting with placeholder values. A test keeps it in step with the settings the code reads.
- **Database roles:** The development database has the same separate migration and application roles as production. Integration tests connect as the application role, so a missing permission fails a test.

### Common Commands

#### Running Fathom

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start development mode: the database with migrations applied, the server and the front end, and open Fathom in the browser |
| `pnpm dev:stop` | Stop this clone's server and front end, leaving the database running |
| `pnpm dev:reset` | Delete the database, create it again with the fictional data and development accounts, print their password, and start development mode |
| `pnpm stack:up`, `pnpm stack:down`, `pnpm stack:reset`, `pnpm stack:logs` | Start, stop, delete the data of, and follow the logs of production-like mode |
| `pnpm build` | Build the front end into `apps/web/dist`, which the server serves when `FATHOM_WEB_ROOT` points to it |

- `pnpm dev` first stops this clone's server and front end if they're running, so running it again restarts them.
- If another program or clone holds one of its ports, `pnpm dev` fails, naming that process, and stops nothing.
- Ctrl+C stops the server and front end. The database keeps running until `pnpm db:down`.

#### The Database

| Command | What it does |
| --- | --- |
| `pnpm db:up`, `pnpm db:down` | Start and stop the development database, reachable only from this machine |
| `pnpm db:migrate` | Apply the migrations, as the migration role |
| `pnpm db:reset` | Delete the database, create it again and apply the migrations |
| `pnpm db:seed` | Add the fictional data and the development accounts, unless they're there, and print the accounts' password |
| `pnpm db:unseed` | Remove the fictional data, keeping what was added by hand, as [Seed Data](#fictional-data) sets out, deactivate the accounts and forget the views they last showed |
| `pnpm db:reseed` | `pnpm db:unseed`, then `pnpm db:seed`, stopping if removing fails |
| `pnpm db:seed:accounts` | Add only the [development accounts](#development-accounts), to try Fathom as a new organization would |

#### Accounts

| Command | What it does |
| --- | --- |
| `pnpm account:create --name <name> --email <email> [--role <role>]` | Create an account and print its one-time password |
| `pnpm admin:create --email <email>` | Create the Fathom Administrator account and print its one-time password |
| `pnpm stack:create-account` and `pnpm stack:create-administrator` | The same, in production-like mode while it runs |

- An account holds Team Member unless `--role` names another starting role, as [Roles](../product/roles.md) names it, in lowercase with hyphens, such as `workforce-administrator`.
- Each new account changes its password at first sign-in.
- `pnpm admin:create` does nothing once any account holds the Administrator role.

#### Checks and Tests

| Command | What it does |
| --- | --- |
| `pnpm check` | Every linter, every test and the security report: the full check from the [Testing Standards](../standards/testing.md#running-tests). `--skip` and a job's name, such as `--skip "Package tests"`, leaves that job out, as the Check workflow does where other runners run it |
| `pnpm check:push` | The tests a change can affect and the linters, side by side, before a push: `pnpm test:changed`, ESLint, the formatting check, type checking and the Markdown and shell linters. It lists each one's result and time, and names any that failed. `--skip` works as for `pnpm check` |
| `pnpm test` | Every test: the script tests, then every package's |
| `pnpm test:changed` | The tests a change can affect; with `--uncommitted`, only the work not yet committed |
| `pnpm test:scripts` | The script tests alone |
| `pnpm test:packages` | Every package's tests; with `--filter` and a package, such as `--filter @fathom/web`, only those packages, as pnpm chooses them |
| `pnpm test:containers` | The container tests: users reach Fathom only through the proxy, and the application and database can't reach the internet |
| `pnpm typecheck` | Type checking across the workspace |
| `pnpm lint`, `pnpm lint:md`, `pnpm lint:shell`, `pnpm lint:licences` | Each linter on its own |
| `pnpm format` | Format the source files |

`pnpm lint` keeps a cache in `.tmp/eslint/`, so unchanged files aren't linted again. `pnpm check` and `pnpm check:push` lint without it, since a change to one file's types can break another file.

#### Security and Upkeep

| Command | What it does |
| --- | --- |
| `pnpm security` | The security report, in a dated folder under `output/security/` |
| `pnpm scan:images` | The daily image scan, as [Releases](#daily-image-scan) describes |
| `pnpm updates` | List dependency updates, in `output/updates/`, changing nothing. On GitHub, the Renovate app opens a pull request for each update, or for each group of related ones, as `renovate.json` sets out, at most five open at once apart from security fixes |
| `pnpm reset-caches` | Remove the scanners' cached data, ESLint's cache and Vitest's caches of compiled files, which the next run rebuilds. It waits for any package tests running on this computer to finish first |
| `pnpm prune-reports [days]` | Delete local reports older than the given days, 365 by default, always keeping security reports for a year |

- `pnpm security` runs its scans side by side.
- It builds and scans the images only when the branch changes what they're built from, as the [Security Plan](../security/security-plan.md#vulnerability-scanning) sets out.
- It reuses an earlier report's Trivy results when nothing they read has changed. Its summary says what it skipped or reused, and from which report.
- `pnpm updates` needs network access to the package and container registries.

#### Release Commands

| Command | What it does |
| --- | --- |
| `pnpm release` | Prepare a release on its own branch |
| `pnpm release:tag` | Tag the release once merged |
| `pnpm publish:images <tag>` | Build, scan and publish the release's images |

See [Releases](#releases) for the steps.

### How the Checks Run

- **Scanners in containers:** The scanners the [Security Plan](../security/security-plan.md) requires run as containers, pinned by digest, so nothing extra is installed.
  - Image scans read an exported image file, never the container runtime itself.
  - `pnpm security`, `pnpm scan:images` and `pnpm publish:images` share each copy's Trivy cache, so only one runs at a time in a copy. Another refuses to start, naming the process that holds the cache.
- **Ignored files:** Every tool reads `.gitignore`.
  - ShellCheck, the REUSE tool, Gitleaks, Semgrep and Trivy see only a copy of the files git would track, made under `.tmp/`, so folders such as `private/` are never read.
  - Trivy also reads `node_modules`, read only, for package licences. The scan of git history sees only git's own folder.
  - ESLint, Prettier, markdownlint and `pnpm audit` run directly on the machine.
- **Downloads:** Most scanners run without network access.
  - Semgrep downloads its rules, and Trivy its vulnerability database.
  - `pnpm audit` asks the package registry.
- **Database tests:** Each test file gets a database of its own.
  - It's copied from a template that the package's run migrates once, in one throwaway PostgreSQL container.
  - It's dropped when the file finishes.
  - A test database server keeps its data in memory and doesn't wait for writes to reach the disk, since it's thrown away.
- **One copy at a time:** Two copies testing at once slow each other until tests time out, so:
  - `pnpm check`, and `pnpm test:changed` when it runs tests, run in one copy at a time on a computer.
  - Package tests run in one copy at a time, whether from `pnpm test`, `pnpm test:changed` or `pnpm check`. `pnpm test` waits only for other copies' package tests, not their checks.
  - A copy that has to wait says so straight away, naming the process and folder it waits for.
  - No more than 8 test database servers start at once on one computer.
  - Each holds a slot file, in a folder of the user's own under the system's temporary folder, until it's done. A slot whose process has ended is taken over.
- **Cores:** Each package's tests use a share of the computer's cores, leaving two free for the development servers. `VITEST_MAX_WORKERS` sets the number instead.

## Fictional Data

`pnpm dev:reset` and `pnpm db:seed` fill the development database with fictional data. `packages/fixtures` makes it with Faker and a fixed seed, and `packages/seed` writes it, recorded in the change history as made by Fathom itself. The code in `packages/seed` has the details.

- **Dated from today:** Everything is dated from the day the data is added, so it looks the same on any day: people still to start, current and gone, schedules with a release shipped, one under way and one to come, and planned hires and drafts ahead.
- **Invented, never real:** Names are generated: mostly Canadian, in English and French, then Indian, and a few from elsewhere, some with accents and some in other scripts, such as Korean, Japanese, Chinese and Russian. Every screen and search is tried with them. No real company, customer or product name is used, as the [Data](../../AGENTS.md#data) rules require.
- **What it holds:**
  - About 150 people, current and former, with positions, managers, and teams, some named and coloured.
  - Lists and People columns, including Personal and Confidential ones.
  - A Kind column on Features, with New, Improvement and Fix.
  - Twelve planned hires, two of them filled.
  - Eight feature teams: Payments core, Search, Platform reliability, Mobile apps, Field tools, Data pipeline, Identity and Integrations.
  - Five customers, five projects with milestones, and proposals in every status.
  - Three schedules, Platform, Patches and Field Apps, each with releases, and features targeting their cycles.
  - Allocations to features, with people over-allocated, under-allocated and not allocated.
  - Drafts by each persona, some approved, some rejected and some left unpublished.
- **New seed data:** A database seeded before the seed data changed keeps its old data. `pnpm db:reseed` or `pnpm dev:reset` brings in the new.
- **Removing it:** `pnpm db:unseed` removes the seed's records and every draft of them, keeps what was added by hand, unless it only changes a seed record, deactivates the accounts and forgets the view each last showed on each page. It keeps a seed record that something added by hand still uses, and says so.

## Development Accounts

Seeding adds these accounts:

- One for each persona in the [Product Brief](../product/brief.md#users), holding its role from [Roles](../product/roles.md#starting-roles). The Feature Lead also holds Engineering Manager, to try switching roles.
- A second Engineering Operations Manager, so some drafts were changed by two people.
- A Superuser, whose role grants every permission, for trying a feature without changing accounts. It isn't a starting role, so a Fathom set up without the seed data doesn't have it.

| Account | Name | Roles |
| --- | --- | --- |
| `product.manager@fathom.test` | Product Manager | Product Manager |
| `project.manager@fathom.test` | Project Manager | Project Manager |
| `engineering.manager@fathom.test` | Engineering Manager | Engineering Manager |
| `feature.lead@fathom.test` | Feature Lead | Feature Lead (default), Engineering Manager |
| `engineering.director@fathom.test` | Engineering Director | Engineering Director |
| `engineering.operations.manager@fathom.test` | Engineering Operations Manager | Workforce Administrator |
| `engineering.operations.manager.2@fathom.test` | Second Engineering Operations Manager | Workforce Administrator |
| `executive@fathom.test` | Executive | Executive |
| `team.member@fathom.test` | Team Member | Team Member |
| `fathom.administrator@fathom.test` | Fathom Administrator | Administrator |
| `superuser@fathom.test` | Superuser | Superuser |

- They share one random password, kept in `.dev/secrets/dev_account_password` so it stays the same between resets. `pnpm db:seed` and `pnpm dev:reset` print it.
- They don't have to change it at first sign-in.
- An account that's already there keeps its password. If that file is replaced, run `pnpm dev:reset` to give every account the new one.

## Releases

A release is made by hand, wherever the repository is hosted, as [ADR 0011](../adr/0011-releases-and-images.md) sets out. Its version is its tag, as [Version and Build](#version-and-build) sets out, and Help's About box shows it once the release's images run.

### Making a Release

1. On an up-to-date, clean default branch, run `pnpm release`. It picks the version, adds the changelog on a `release/vX.Y.Z` branch, and pushes that branch.
1. Open a pull request from that branch, and merge it.
1. On the updated default branch, run `pnpm release:tag` to tag the merge.
1. Push the tag with `git push origin vX.Y.Z`. On GitHub, the Draft release workflow builds and scans the tag's images, then makes a draft release for it, with notes listing the pull requests merged since the last release, dependency updates apart from other changes. A tag with a pre-release part, such as `v0.2.0-rc.1`, is drafted as a pre-release.
1. Review the draft on GitHub's Releases page, edit its notes if you like, and publish it soon: the daily image scan reads the newest release tag, and fails while its images aren't published. Publishing runs the Publish release images workflow, which publishes the release's images.
1. If a scan fails, the release isn't drafted or its images aren't published. Fix the cause, then run the Publish release images workflow by hand with the tag, or `pnpm publish:images vX.Y.Z` elsewhere. If the release can't go ahead, delete its draft, if any, and the tag, locally and with `git push origin --delete vX.Y.Z`.

`pnpm release` and `pnpm release:tag` both take `--dry-run`.

### Publishing the Images

- `pnpm publish:images` builds the application, database and proxy images for linux/amd64, from a clean copy of exactly the tag.
- It scans them as the security report does, reusing an earlier scan of an image that hasn't changed.
- It fails if a fix is overdue or has no known release date, as the [Security Plan](../security/security-plan.md#vulnerability-scanning) sets out.
- Otherwise it pushes each image, tagged with the version, such as `ghcr.io/ribbitworks/fathom-app:0.1.0`.
- The scan's summary goes in a dated folder under `output/security/`.
- With `--dry-run`, it builds and scans, and only prints what it would push.

### Where Images Go

- `FATHOM_REGISTRY` sets the registry and owner, `ghcr.io/ribbitworks` unless set.
- Sign in to it first, such as with `docker login ghcr.io`. No registry password is kept in the repository.
- On GitHub, the Publish release images workflow does the same when a release is published, or when run by hand from the Actions tab with the tag. It uses the default branch's scripts and security exceptions, signs in with the workflow's own token, publishes to the repository owner's registry, and makes no tags or releases itself.
- **Making them public:** GitHub's registry makes each package, `fathom-app`, `fathom-postgres` and `fathom-proxy`, private when its first release is published. So that anyone can pull a release:
  1. An organization owner allows public packages: the organization's Settings, then Packages, then Package creation, with Public ticked.
  1. For each package, open it from the organization's Packages tab, then Package settings, then Danger Zone, and change its visibility to Public.
  1. Check it signed out: `docker logout ghcr.io`, then `docker pull ghcr.io/ribbitworks/fathom-app:<version>` succeeds.
- **No way back:** A public package can't be made private again.

### What Each Image Says

- Every image holds Fathom's `LICENSE` and `NOTICE` in `/usr/share/doc/fathom/`.
- It's labelled with its source, licence, version and full commit, under the Open Container Initiative's `org.opencontainers.image` names.
- The source is `FATHOM_SOURCE_URL`, or else the `origin` remote's web address without any credentials.
- It's dated by the tagged commit's time, not the build's.
- That fixes its labels and dates, not its digest. Each build takes the security fixes released by that day, and installed files keep the times they were built, so building a tag again gives a different digest, as [issue #261](https://github.com/ribbitworks/fathom/issues/261) records.

### Daily Image Scan

- `pnpm scan:images` builds the images from the checked-out code.
- It pulls the images of the newest full release, leaving out pre-releases, from `FATHOM_REGISTRY`, since those are what people most likely run. It signs in first if the registry needs it.
- It scans them all as a release's scan does.
- With no release yet, it says so and scans only the built images.
- A release whose images can't be pulled counts as not scanned, so the scan fails.
- On GitHub, the Scan images daily workflow runs it on the default branch every day, and can be run by hand from the Actions tab.
  - A failed scan fails the run. GitHub emails the person who last changed the workflow's schedule, if their notification settings allow.
  - The scan and its summary are kept with the run for 90 days, the longest GitHub allows a public repository.
- Another host's scheduler can run `pnpm scan:images` the same way.

## The Repository on GitHub

The settings the repository has on GitHub, and where each is set, so they can be checked or set up again.

### Rulesets

Under **Settings** → **Rules** → **Rulesets**:

- **main:** on the default branch, with nobody allowed to bypass it.
  - Changes reach it only through a pull request, merged by rebasing, so each commit lands as written, as the [Agent Workflow](../standards/agent-workflow.md#rules-for-both-modes) sets out. No approving review is required, since the maintainer merges.
  - **Full check** and **Container tests**, from GitHub Actions, must pass.
  - It can't be deleted or force-pushed.
  - A pull request's branch needn't be up to date with it before merging, since the code is rebased onto `main` before it's pushed, as the [Testing Standards](../standards/testing.md#running-tests) set out.
- **release tags:** on `refs/tags/v*`. Only the Repository admin role may create, move or delete a release tag, since a published release runs its workflow from its tag.

### Pull Requests

Under **Settings** → **General** → **Pull Requests**, only **Allow rebase merging** is on, with **Automatically delete head branches** on, and auto-merge and **Always suggest updating pull request branches** off.

### Actions

Under **Settings** → **Actions** → **General**:

- **Actions permissions:** every action is allowed, and **Require actions to be pinned to a full-length commit SHA** is on, so no workflow can use an action by a tag that could move, as the [Security Plan](../security/security-plan.md#tampering) sets out.
- **Workflow permissions:** read repository contents and packages only, and Actions can't create or approve pull requests. Each workflow asks for more, job by job, where it needs it.
- **Fork pull request workflows:** approval is required for all external contributors.

### Security

Under **Settings** → **Advanced Security**:

- **Private vulnerability reporting:** on, as the [Security Policy](../../SECURITY.md) sets out.
- **Dependabot alerts:** on, since Renovate learns of security fixes from them. Dependabot security updates are off, since Renovate opens every update's pull request, security fixes included.
- **Secret scanning and push protection:** on, for the kinds of secret GitHub's partners define. Its non-provider patterns and validity checks are off.
- **CodeQL analysis:** the default setup and its default queries. [ADR 0002](../adr/0002-libraries.md) sets out why it runs beside Semgrep.

### Renovate

- **The app:** the Renovate GitHub App is installed on the `ribbitworks` organization for selected repositories, `ribbitworks/fathom` among them, under the organization's **Settings** → **GitHub Apps** → **Renovate** → **Configure**.
- **Its service:** on the [Mend developer portal](https://developer.mend.io), under the organization's **Settings** → **Dependencies**: Dependency Updates on, Silent mode off, Automated PRs on, Require config file on, and Create onboarding PRs off.
- **What it updates:** `renovate.json` sets that, and how its pull requests read, as [ADR 0002](../adr/0002-libraries.md) sets out. Its Dependency Dashboard issue lists the updates waiting.

### Issues

The issue forms are in `.github/ISSUE_TEMPLATE/`, whose `config.yml` turns blank issues off. Under **Settings** → **General** → **Features**, the wiki, Projects and Discussions are off.
