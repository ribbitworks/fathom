# Tech Stack

- **ADR:** 0001
- **Status:** Accepted
- **Date:** 2026-10-26

## Context

Fathom's [Product Brief](../product/brief.md) sets the constraints that drive the stack:

- **Hosting:** Runs in Docker containers under WSL 2 on a Windows Server, on-premises, with intranet access only. Nothing may depend on internet services at runtime, including CDNs and web fonts.
- **Scale:** Tens of users and a modest amount of data. Simplicity matters more than horizontal scaling.
- **Front end:** Rich, interactive timeline, Gantt, org chart, and capacity views, with drag-and-drop. The strongest choice of components for these is in the React ecosystem, so every option below uses a React front end.
- **Security:** Local accounts, role-based access to tiers of data, enforced the same way in screens, exports, snapshots, and search. Personal data is kept out of logs.
- **Operations:** Snapshots, plus automated, encrypted backups, expected to be run by the department rather than IT.

The owner's preferences:

- **Maintainers:** In the short term, a group effort within the department, including the owner. Software Engineering Managers are technical.
- **Language:** Modern languages. The owner dislikes Windows, so development and operations should avoid Windows-specific tooling where the Windows Server host allows.
- **Database:** PostgreSQL is the owner's favourite, with openness to lighter-weight options.

## Options Considered

### TypeScript End to End

React single-page app built with Vite, a Node.js API server, and PostgreSQL.

- **For:** One language across the front end and back end, which lowers the barrier for a group of maintainers. Validation schemas and API types are shared between client and server.
- **Against:** The back end needs more assembly than a batteries-included framework, such as choosing libraries for authentication, migrations, and validation. The npm ecosystem brings many dependencies, frequent upgrades, and supply-chain exposure.

### Python Back End with a React Front End

Django or FastAPI API server, React front end, and PostgreSQL.

- **For:** Django provides authentication, permissions, migrations, and an admin interface out of the box, which suits a role-based data management tool. Python is widely known.
- **Against:** Two languages to maintain. API types must be generated or kept in sync between Python and TypeScript.

### Go Back End with a React Front End

Go API server, React front end, and PostgreSQL.

- **For:** A single small binary, fast, with simple deployment.
- **Against:** Two languages, and Go is more verbose for data-heavy business logic with many entities and rules.

### Other Back Ends

ASP.NET Core and Java are modern, run on Linux, and are common in Windows Server environments. They were not preferred because they also mean two languages alongside a React front end, and they do not match the owner's preferences as well.

### Database Options

- **PostgreSQL:** Mature, strong data integrity, good support for history and snapshot data, and mature backup and admin tooling. Runs as a second container.
- **SQLite:** No separate server, and the whole database is one file. Backups are simple, using its online backup command rather than a plain file copy. It is viable at Fathom's scale, but leaves less room to grow.

## Decision

**TypeScript end to end with PostgreSQL**. PostgreSQL is chosen for the owner's preference, its mature backup and admin tooling, and room to grow, although SQLite would be viable at this scale.

- **Front end:** React and TypeScript, built with Vite. All assets, including fonts, are bundled into the build so nothing loads from the internet.
- **Back end:** A Node.js API server in TypeScript on a Long Term Support (LTS) release, sharing types and validation schemas with the front end.
- **Database:** PostgreSQL, accessed through a type-safe ORM or query builder with versioned migrations.
- **Access control:** Implemented once in the server's data access layer, so every screen, export, snapshot, and search goes through the same tier-based checks.
- **Transport security:** HTTPS using an internal certificate, since passwords and personal data cross the intranet.
- **Packaging:** Docker Compose with two containers, the application and PostgreSQL. The application server also serves the built front end.
- **Docker runtime:** Docker Engine installed directly inside WSL 2, rather than Docker Desktop, which is not supported on Windows Server and requires a paid subscription for larger companies.
- **Backups:** A scheduled job runs `pg_dump`, encrypts the output with a public key whose private key is held by someone other than the person running the job, and writes it to an approved location. Restores are tested regularly.

Specific libraries (API framework, ORM, Gantt and org chart components, test tools) are chosen in follow-up decisions.

## Consequences

- **Maintainers** work in one language, which suits a group effort within the department.
- **Dependencies** need active care: Node.js stays on an LTS release, and dependency upgrades are planned rather than ad hoc.
- **Gantt and timeline components** are the biggest technical risk. Free and commercial options vary widely in features and licensing. Some are GPL-licensed, which would require Fathom, if distributed, to be released under the GPL instead of Apache 2.0. A short evaluation should come before UI work starts.
- **Access control** depends on discipline: all data access must go through the shared layer, which the code review standards should check.
- **Running on WSL 2 on Windows Server** needs setup the department will own:
  - WSL and Docker do not start at boot by default, so the host needs a startup task, with systemd enabled in the Linux distribution.
  - WSL 2 uses NAT networking by default, so intranet users cannot reach Fathom until port forwarding or mirrored networking is configured.
  - The server is intranet-only, so container images and dependencies must be built elsewhere and transferred, or pulled from an internal registry.
  - The database and backup staging folders live on the Linux filesystem, not the Windows drive, for performance and file permissions.
- **Two containers** instead of one, a small operational cost in exchange for PostgreSQL.
- **Python** remains a reasonable alternative if the department's maintainers are much more comfortable with it than with TypeScript.
