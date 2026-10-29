# Libraries

- **ADR:** 0002
- **Status:** Accepted
- **Date:** 2026-10-26
- **Revised:** 2026-10-27, to add Faker for fictional data, to point to the roadmap's After Hello Fathom section, to add the development and scanning tools, to choose the PostgreSQL driver, and to choose the database image; 2026-10-28, to adopt the REUSE specification for copyright and licence information, and to keep client addresses in request logs for security investigations; 2026-10-29, to add React's rules of hooks to linting

## Context

[ADR 0001](0001-tech-stack.md) chose TypeScript end to end, React with Vite, Node.js, and PostgreSQL, and left specific libraries to a follow-up decision. The [Implementation Plan](../design/implementation-plan.md) needs them before Hello Fathom.

What matters most in these choices:

- **Security:** Fathom holds personal data, so authentication, sessions, input validation, and logging must use well-tested libraries, and the [Security Plan](../security/security-plan.md)'s mitigations must be straightforward to apply.
- **Access control in one place:** Every read goes through one data access layer that applies tier checks, so database access should be explicit and easy to review.
- **Small team, long life:** Choices should be widely used, well maintained, and few in number.
- **Supply chain:** Fewer, more trustworthy dependencies, and package management that resists malicious packages.

## Decision

### Library Choices

| Area | Choice | Main alternative | Why |
| --- | --- | --- | --- |
| Package manager and workspaces | pnpm | npm | Blocks dependency install scripts unless allowed, and can delay newly published versions, which reduces supply-chain risk |
| API framework | Fastify, serving the built front end with @fastify/static | Hono, NestJS | Mature and fast, with maintained plugins for security headers and rate limiting |
| Validation | Zod, connected to Fastify through fastify-type-provider-zod | Valibot | One set of schemas shared by the front end and the API, used for request and form validation |
| API contract | Shared Zod schemas and TypeScript types | OpenAPI | The front end and API live in one repository, so shared types are enough for now |
| Forms | React Hook Form with its Zod resolver | TanStack Form | Widely used, and validates with the same shared schemas |
| Database access | Drizzle ORM | Kysely, Prisma | TypeScript-first and close to SQL, so the queries behind tier checks stay explicit |
| PostgreSQL driver | node-postgres (`pg`) | postgres.js | The most widely used PostgreSQL driver for Node.js, and fully supported by Drizzle |
| Migrations | drizzle-kit, generating SQL migration files | Hand-written SQL | Migrations are plain SQL files reviewed like any other change |
| Authentication and sessions | Better Auth, with sessions stored in the database | A small in-house implementation | A maintained library for local accounts, password hashing, sessions, and sign-in rate limiting, rather than writing security-critical code ourselves |
| Password hashing | Better Auth's default, scrypt | Argon2id through Better Auth's custom hashing hooks | scrypt is an accepted password hashing algorithm and needs no native module; to be confirmed in Hello Fathom |
| Logging | Pino, Fastify's built-in logger | Winston | Structured logs, with redaction of known fields |
| Front-end routing and data fetching | TanStack Router and TanStack Query | React Router | Type-safe routes and consistent loading, caching, and error handling |
| Tables | TanStack Table | A component library's table | The first stage is mostly tables; headless, so styling stays separate |
| Unit and integration tests | Vitest, with Testcontainers for PostgreSQL | Jest | Fast and Vite-native; integration tests run against a real PostgreSQL database |
| Fictional data | Faker, as a development-only dependency | Hand-written generators | Widely used, with locale-aware realistic names and a fixed seed for repeatable data |
| UI tests | Playwright | Cypress | Cross-browser; these are UI tests, so they are not run in the workflow's test step |
| Linting and formatting | ESLint with typescript-eslint's strict type-checked rules, eslint-plugin-security, and eslint-plugin-react-hooks for the front end, and Prettier | Biome | Type-aware rules, security rules, and React's rules of hooks |
| Static analysis | Semgrep Community Edition, run with metrics off | CodeQL | Runs locally and in any build process; CodeQL is free only for public repositories |
| Secret scanning | Gitleaks | TruffleHog | Fast, runs offline, and scans both files and git history |
| Vulnerability, misconfiguration, and licence scanning | Trivy, with telemetry off | Grype | One tool for dependencies, container images, configuration, and licences |
| Shell script linting | ShellCheck | | The standard linter for shell scripts |
| PowerShell linting | PSScriptAnalyzer | | The standard linter for PowerShell, including checks for compatibility with Windows PowerShell 5.1 |
| Copyright and licence information | The REUSE specification, checked with the REUSE tool | Per-file copyright headers only | A standard, machine-readable way to state each file's licence, checked automatically, while the copyright is stated once, matching NOTICE, rather than in every file |
| Node.js version management | fnm | nvm, Volta | Fast, works on macOS, Linux, and Windows, and switches versions automatically from `.node-version` |

UI components, styling, charts, and the Gantt, timeline, and org chart components are left to the component evaluation in the roadmap's [After Hello Fathom](../product/roadmap.md#after-hello-fathom) section.

### Versions

Node.js runs on its current Active LTS release, and PostgreSQL on its latest major release, when Hello Fathom is built. All versions are pinned and updated deliberately.

### Security Responsibilities

Which component provides each security mitigation:

- **Sign-in, sessions, and session cookies:** Better Auth, with secure, HttpOnly, SameSite cookies.
- **Cross-site request forgery:** Better Auth checks the request origin on its own routes, and Fathom applies the same origin check to every other request that changes data.
- **Rate limiting:** Better Auth limits sign-in attempts, with its limits stored in the database and enabled in every environment. @fastify/rate-limit limits all other requests.
- **Security headers:** @fastify/helmet.
- **Logs:** Pino redacts known sensitive fields, and database errors are logged by type and code, without their details. Personal data is never passed to the logger, and request logging leaves out query strings. The one exception is each request's client address, which is logged to investigate security problems.

Better Auth settings that the security plan relies on:

- **No public sign-up:** Accounts are created only by administrators.
- **No session caching in cookies:** Role changes and account deactivation take effect immediately.
- **Password resets by administrators:** No email is sent.
- **Telemetry off:** Set explicitly, although it is off by default.

### Configuration and Deployment

- **HTTPS:** Fastify terminates HTTPS itself, with no separate proxy, as ADR 0001's two containers imply.
- **Configuration:** Settings come from environment variables and secrets from mounted files, all validated with Zod at start-up.
- **Migrations:** Run as a separate step before the application starts, using a migration database role that can change the schema. The application's own database role can only read and write data. Schema changes are never pushed directly with drizzle-kit; only reviewed migration files reach the database.
- **Base images:** Builds use Debian slim images, so prebuilt binaries for glibc work. The application runs on a minimal distroless image, to reduce what can be attacked.
- **Database image:** Fathom's own image, based on the official PostgreSQL Alpine image. It applies the security fixes released up to the day it is built, removes gosu, which is only needed to start as root, and includes Fathom's first-time setup scripts. Alpine was chosen over Debian because its known vulnerabilities all have fixes available. Development, tests, the security report, and production all build the image from the same Dockerfile.
- **Sorting:** The database sorts text with ICU's international rules, set when the database is created because it cannot be changed afterwards. When an image update changes the ICU version, affected indexes must be rebuilt (`REINDEX`) and the collation version refreshed (`ALTER DATABASE ... REFRESH COLLATION VERSION`).
- **Dependency updates:** Renovate finds dependency updates, run locally until there is a shared repository. Its updates are reviewed like any other change.

## Consequences

- **Authentication library maturity:** Better Auth is newer than the other choices. If it proves unsuitable, the alternative is a small in-house session layer following established guidance, with Argon2id password hashing. Hello Fathom and the Accounts and Access Control slice confirm it, including its password hashing.
- **Database access:** Drizzle keeps queries explicit, but tier checks are not automatic; the shared data access layer and its tests enforce them.
- **Native modules:** If a native module is ever added, dependencies are installed inside the linux/amd64 build, never copied from a machine with a different processor, and the module is explicitly allowed to run its install script in pnpm.
- **Testcontainers:** Must be verified on each development runtime in [Supported Platforms](../operations/supported-platforms.md). Runtimes other than Docker need extra configuration, and tests need access to the container images they use.
- **Semgrep:** Community Edition checks one file at a time. Its registry rules are used at scan time, not copied into the repository, because they have their own licence. Opengrep is the fallback if Semgrep's licensing changes.
- **Two lint tools:** ESLint and Prettier mean two tools to configure, in exchange for type-aware and security rules.
