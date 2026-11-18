# Libraries

- **ADR:** 0002
- **Status:** Accepted
- **Date:** 2026-10-26
- **Revised:** 2026-10-27, to add Faker for fictional data, to point to the roadmap, to add the development and scanning tools, to choose the PostgreSQL driver, and to choose the database image; 2026-10-28, to adopt the REUSE specification for copyright and licence information, and to keep client addresses in request logs for security investigations; 2026-10-29, to add React's rules of hooks to linting; 2026-10-30, to reflect the proxy chosen in ADR 0003, to point to the UI components chosen in ADR 0004, to record session length and how sign-in limits find each client's address, to let users change their own password, and to record that Better Auth and its password hashing were confirmed in use; 2026-11-01, to shorten sessions from 12 hours to 30 minutes without use, with the browser signing out on its own; 2026-11-06, to add zxcvbn-ts for refusing passwords that are easy to guess, and to add the Markdown libraries for notes; 2026-11-15, to add rehype-slug for the anchors of Help pages' headings, with github-slugger in tests; 2026-11-17, to drop PowerShell linting, since Fathom has no PowerShell scripts, and to run Renovate as the GitHub App; 2026-11-18, to add CodeQL on GitHub beside Semgrep, now that the repository is public

## Context

[ADR 0001](0001-tech-stack.md) chose TypeScript end to end, React with Vite, Node.js, and PostgreSQL, and left specific libraries to a follow-up decision.

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
| Password hashing | Better Auth's default, scrypt | Argon2id through Better Auth's custom hashing hooks | scrypt is an accepted password hashing algorithm and needs no native module, and is confirmed in use |
| Password strength | zxcvbn-ts, with its common and English dictionaries (MIT) | A list of common passwords alone | Estimates how easily a password is guessed from common passwords, words, names, keyboard patterns, and the person's own details, and runs the same in the browser and on the server; the browser loads its dictionaries only when a form for a new password opens |
| Logging | Pino, Fastify's built-in logger | Winston | Structured logs, with redaction of known fields |
| Front-end routing and data fetching | TanStack Router and TanStack Query | React Router | Type-safe routes and consistent loading, caching, and error handling |
| Tables | TanStack Table | A component library's table | The first stage is mostly tables; headless, so styling stays separate |
| Unit and integration tests | Vitest, with Testcontainers for PostgreSQL | Jest | Fast and Vite-native; integration tests run against a real PostgreSQL database |
| Notes' Markdown | [unified](https://unifiedjs.com) with remark-parse, remark-gfm, and remark-stringify in the shared package, and react-markdown with rehype-raw and rehype-sanitize in the browser, with rehype-slug giving Help pages' headings GitHub's anchors, and github-slugger, the same slugs, in tests | markdown-it, or marked with DOMPurify | One parser, the same in the server and the browser, gives a syntax tree to check against the notes' allowlist and writes every note back the same way; rehype-sanitize filters what is shown by an allowlist without a browser's DOM. markdown-it and marked turn Markdown straight into HTML, which then needs sanitising and cannot be checked or written back |
| Fictional data | Faker, as a development-only dependency | Hand-written generators | Widely used, with locale-aware realistic names and a fixed seed for repeatable data |
| UI tests | Playwright | Cypress | Cross-browser; these are UI tests, so they are kept out of `pnpm test` |
| Linting and formatting | ESLint with typescript-eslint's strict type-checked rules, eslint-plugin-security, and eslint-plugin-react-hooks for the front end, and Prettier | Biome | Type-aware rules, security rules, and React's rules of hooks |
| Static analysis | Semgrep Community Edition, run with metrics off | CodeQL | Runs locally and in any build process; CodeQL is free only for public repositories |
| Secret scanning | Gitleaks | TruffleHog | Fast, runs offline, and scans both files and git history |
| Vulnerability, misconfiguration, and licence scanning | Trivy, with telemetry off | Grype | One tool for dependencies, container images, configuration, and licences |
| Shell script linting | ShellCheck | | The standard linter for shell scripts |
| Copyright and licence information | The REUSE specification, checked with the REUSE tool | Per-file copyright headers only | A standard, machine-readable way to state each file's licence, checked automatically, while the copyright is stated once, matching NOTICE, rather than in every file |
| Node.js version management | fnm | nvm, Volta | Fast, works on macOS, Linux, and Windows, and switches versions automatically from `.node-version` |

UI components, styling, charts, and the Gantt, timeline, and org chart components are chosen in [ADR 0004](0004-ui-components.md), after a component evaluation.

### Versions

Node.js runs on an Active LTS release, and PostgreSQL on its latest major release. All versions are pinned and updated deliberately.

### Security Responsibilities

Which component provides each security mitigation:

- **Sign-in, sessions, and session cookies:** Better Auth, with secure, HttpOnly, SameSite cookies.
- **Cross-site request forgery:** Better Auth checks the request origin on its own routes, and Fathom applies the same origin check to every other request that changes data.
- **Rate limiting:** Better Auth limits sign-in attempts, with its limits stored in the database and enabled in every environment. @fastify/rate-limit limits all other requests.
- **Security headers:** @fastify/helmet.
- **Logs:** Pino redacts known sensitive fields, and database errors are logged by type and code, without their details. Personal data is never passed to the logger, and request logging leaves out query strings. The one exception is each request's client address, which is logged to investigate security problems.

Better Auth settings Fathom's security relies on:

- **No public sign-up:** Accounts are created only by administrators.
- **No session caching in cookies:** Role changes and account deactivation take effect immediately.
- **Password resets by administrators:** No email is sent. Users change their own password by giving their current one, which signs out their other sessions.
- **Sessions:** End after 30 minutes without use. A session's expiry is pushed back at most once a minute while it is in use, which writes to the database at most once a minute for each session in use, a small load at Fathom's [scale](../product/brief.md#constraints). The browser signs out on its own once none of the user's Fathom tabs has had a key, click, touch, scroll, or mouse movement for 30 minutes, and while there is use it keeps the session alive on the server, telling it at most once a minute, so the server's session ends no more than about two minutes before the browser signs out; the sign-in page then says why, and brings the user back to the page they were on.
- **Client addresses:** Sign-in limits use only the client address the server passes to Better Auth, never one a client sends, so they cannot be dodged.
- **Telemetry off:** Set explicitly, although it is off by default.

### Configuration and Deployment

- **HTTPS:** Fastify terminates HTTPS itself. The proxy chosen in [ADR 0003](0003-edge-proxy.md) passes encrypted connections through without decrypting them.
- **Configuration:** Settings come from environment variables and secrets from mounted files, all validated with Zod at start-up.
- **Migrations:** Run as a separate step before the application starts, using a migration database role that can change the schema. The application's own database role can only read and write data. Schema changes are never pushed directly with drizzle-kit; only reviewed migration files reach the database.
- **Base images:** Builds use Debian slim images, so prebuilt binaries for glibc work. The application runs on a minimal distroless image, to reduce what can be attacked.
- **Database image:** Fathom's own image, based on the official PostgreSQL Alpine image. It applies the security fixes released up to the day it is built, removes gosu, which is only needed to start as root, and includes Fathom's first-time setup scripts. Alpine was chosen over Debian because its known vulnerabilities all have fixes available. Development, tests, the security report, and production all build the image from the same Dockerfile.
- **Sorting:** The database sorts text with ICU's international rules, set when the database is created because it cannot be changed afterwards. When an image update changes the ICU version, affected indexes must be rebuilt (`REINDEX`) and the collation version refreshed (`ALTER DATABASE ... REFRESH COLLATION VERSION`).
- **Dependency updates:** Renovate, as the Renovate GitHub App on the repository, opens a pull request for each dependency update, with commit messages and descriptions that follow the Commit Message Rules, and security fixes without the seven-day wait. Its updates are reviewed like any other change.

## Consequences

- **Authentication library maturity:** Better Auth is newer than the other choices. If it proves unsuitable, the alternative is a small in-house session layer following established guidance, with Argon2id password hashing. Fathom's accounts confirm it in use, including its password hashing.
- **Database access:** Drizzle keeps queries explicit, but tier checks are not automatic; the shared data access layer and its tests enforce them.
- **Native modules:** If a native module is ever added, dependencies are installed inside the linux/amd64 build, never copied from a machine with a different processor, and the module is explicitly allowed to run its install script in pnpm.
- **Testcontainers:** Must be verified on each development runtime in [Supported Platforms](../operations/supported-platforms.md). Runtimes other than Docker need extra configuration, and tests need access to the container images they use.
- **Semgrep:** Community Edition checks one file at a time. Its registry rules are used at scan time, not copied into the repository, because they have their own licence. Opengrep is the fallback if Semgrep's licensing changes.
- **CodeQL on GitHub:** Since the repository is public, CodeQL's default setup also runs on GitHub, for the JavaScript and TypeScript code and the GitHub Actions workflows, on pull requests, pushes to `main`, and weekly. Semgrep stays in `pnpm check`, so every copy of the repository scans before it pushes.
- **Two lint tools:** ESLint and Prettier mean two tools to configure, in exchange for type-aware and security rules.
