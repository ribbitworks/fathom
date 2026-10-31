# Fathom — Security Plan

**Status:** Proposal for review by the owner and IT
**Last updated:** 2026-10-30

How Fathom is protected: what it must protect, the threats against it, how each threat is mitigated and verified, how its technology is scanned for vulnerabilities, how confidence in its source code is established, and how the plan is enforced. It builds on [ADR 0001](../adr/0001-tech-stack.md), the [Decisions Log](../product/decisions.md), and [Roles](../product/roles.md). Everything here is proposed until reviewed.

## Assets

- **Employee personal information:** General, Restricted, and Confidential data, including the hiring plan.
- **User accounts:** Credentials, sessions, and role assignments.
- **Access history:** The record of who viewed or changed sensitive data.
- **Secrets:** The credentials listed under Credentials and Secrets.
- **Backups**
- **The host:** Its operating system, any virtualization layer such as WSL 2, the container runtime, and Fathom's containers.
- **Source code, dependencies, and the build process**

## Trust Boundaries

- **Users to Fathom:** Browsers on the internal network connect to Fathom over HTTPS, through a proxy that passes the encrypted traffic to the application without decrypting it.
- **Internet and Fathom:** Fathom must not be reachable from the internet. The host may have outbound internet access, which Fathom's containers must not use at runtime.
- **Fathom to its database:** The application container talks to the database container on an internal Docker network that the proxy is not on.
- **Server operators to Fathom's data:** People who can log in to the server or run Docker can reach the database directly, outside Fathom's role checks.
- **Other applications on the host:** A shared host may run other applications, whose administrators and vulnerabilities are outside Fathom's control.
- **Host to containers:** The host runs the container runtime, inside any virtualization layer, which runs the containers.
- **Backups leaving the server:** Encrypted backups are copied to an approved location.
- **Code entering the server:** Source code, dependencies, and container images are built and brought onto the server through a build process still to be decided.

## Threats and Mitigations

| Threat | Mitigation | How it is verified |
| --- | --- | --- |
| Someone on the internet reaches Fathom | Fathom's port is open only to the internal network; the host firewall blocks inbound internet traffic | External port scan |
| Other services on the server are reachable from the internal network | Only Fathom's HTTPS port is exposed; the database port is never published | Internal port scan |
| A compromised component sends data to the internet | The application and database containers are on internal networks with no route out; only the proxy, which never sees decrypted data or secrets, is on a network with a route out, and its outbound traffic is blocked on the host where possible; downloads happen only during controlled updates from approved sources | Container tests from inside the application and database containers that outbound connections and internet name lookups fail |
| Someone on the internal network without an account reaches data | Every request requires sign-in; no anonymous access | Automated tests |
| Another container poses as the proxy to forge users' addresses, evading rate limits or misleading the logs | The application accepts connections, and the user addresses they name, only from the proxy's address | Automated tests; container tests |
| A user sees or changes data beyond their roles | Tier checks in one shared data access layer, used by screens, exports, snapshots, and search | Automated tests for every role and tier; code review |
| A user grants themselves more access | Administrators cannot change their own roles, reset their own password, or deactivate their own account. They can still create another account or reset another user's password and sign in as them, which local passwords cannot prevent, so account creation, role changes, password resets, and deactivations are recorded in the access history | Automated tests; access history review |
| Passwords are guessed or stolen | Strong password hashing, sign-in rate limiting, and session expiry | Automated tests; configuration review |
| Sessions are hijacked, or requests forged from another site | Secure, HttpOnly, SameSite session cookies and cross-site request forgery protection | Automated tests; web application scan |
| Traffic is intercepted on the internal network | HTTPS with an internal certificate; no unencrypted access | TLS configuration scan |
| Injection attacks, such as SQL injection or cross-site scripting | Parameterized queries, output encoding, input validation with shared schemas, and a content security policy that allows scripts only from Fathom's own files. Inline styles are allowed, since many UI components set them. Styles cannot run code, and the policy still stops them loading anything from other sites; the accepted risk is that markup injected past output encoding restyles a page to hide or fake its content | Automated tests, including a check that the built front end needs nothing the policy blocks; static analysis; web application scan |
| A user sees custom field values beyond their roles, directly or through filtering and sorting | Every custom field and table has a tier, and the data access layer leaves out values from fields the user's tiers do not cover and refuses to filter or sort by them | Automated tests for every role and tier |
| The change history reveals data a user cannot see, such as an end date or its old value | Each change records the tier of the field it changed, so that wherever the history is shown, a user sees only changes in the tiers their roles cover. Nothing shows it yet | Automated tests for every role and tier, added when the history is first shown |
| A custom field is used to hold personal information HR has not approved | Only roles that maintain people data can define fields that hold personal information or link to people; a field can be assigned only a tier its creator can see; new personal fields are brought to HR before use | Review of custom field definitions before each privacy review; automated tests of who can define fields |
| Server operators read the database directly | Server login limited to named people; database credentials stored as secrets, and every database login, including inside the container, requires a password. Anyone who can run commands in Fathom's containers can still read those passwords from the container's secrets. The remaining risk is accepted and recorded | Review of who has server login |
| Another application on a shared host is compromised and used to reach Fathom | Fathom has its own container network and no shared database; only Fathom's HTTPS port is published, the database port never is, and published ports are restricted by bind address and firewall. A separate WSL 2 distribution is not full isolation, since all distributions on a host share one virtual machine, kernel, and by default network; if other applications on the host use WSL 2 or Docker, the remaining risk is recorded or a separate virtual machine is requested | Configuration review; internal port scan |
| Administrators of other applications on a shared host reach Fathom's data | Fathom's environment is registered to a dedicated account used only by its named operators. Anyone with full administrator access to the host can still reach the data and the secrets stored on it; this remaining risk is accepted and recorded | Review of who has host and environment login |
| The application changes the database schema or the record of applied migrations | The application connects with a role that can only read and write data in Fathom's schema. Only the migration role, used for upgrades, can change the schema, and the record of applied migrations is closed to the application | Database tests for each permission the application role has and lacks |
| A database role connects to databases other than Fathom's, or uses the shared public schema | Connection rights are removed from every role except Fathom's two roles on Fathom's database, and nobody may create objects in the public schema | Database tests |
| Database passwords are weak, reused, or stored insecurely | Passwords are random for each installation, stored with SCRAM-SHA-256, and every connection, including over the local socket, requires one | Database tests; credential review |
| Database administrator credentials are misused over the network | Fathom connects with a limited database account; administrator credentials are kept in the secret store, not on the host, and used only for maintenance; the database refuses superuser logins over the network, including for replication. Direct access from inside the containers is covered by the server operators row | Database tests; configuration review; credential review |
| The change history is altered or deleted, hiding who changed what | The change history can only be added to, enforced the same way as the access history below | Database tests |
| The access history is altered or deleted | Access history can only be added to: the application's database role cannot change or delete entries, and the database refuses any change or deletion, even by the role that owns the table, unless a reviewed migration removes that refusal. Direct database access is covered by the server operators row | Database tests |
| Secrets leak | Secrets are kept out of the repository and container images | Secret scanning |
| A vulnerable or malicious dependency or container image | Pinned versions from trusted sources; dependency and image scanning | Scans on every build and on a schedule |
| The build environment or a developer machine is compromised | Builds come from a known environment, each release is tagged and built repeatably, and releases are compared with their source | Release verification |
| A compromised container is used to attack the host or other containers | Every container runs as a user other than root, with a read-only filesystem, every Linux capability dropped, no way to gain new privileges, and no access to the host's network; ports are published only on the addresses intended | Automated tests of every Compose file |
| An unpatched host, virtualization layer, container runtime, or database | Regular patching of every layer | Host and container vulnerability scans |
| Personal data leaks through logs or error messages | Personal data kept out of logs, except each request's client address, which is kept to investigate security problems; generic error messages to users | Automated tests; code review; log review |
| Backups are stolen or read | Encrypted backups, with the key held by someone other than the backup operator | Restore tests; key custody check |
| A former user keeps access | Accounts are disabled when users leave | Account review |
| Real data leaks into development | Fictional data only in development; real data never committed | Code review; repository scanning |
| Fathom is overwhelmed with requests | Memory and process limits on every container, a connection limit at the proxy, and request rate limiting | Configuration review; automated tests |

## Credentials and Secrets

Every credential has an owner. Its master copy is kept in a password manager or secret store, never in the repository or container images. Credentials Fathom needs while running, such as the HTTPS private key and the database application password, also have a runtime copy on the host, readable only by Fathom's service account, and so are exposed to anyone with full administrator access to the host. Each credential is changed by its owner when someone with access to it leaves, and at an interval set at the quarterly credential review.

| Credential | Owner | Notes |
| --- | --- | --- |
| Database administrator account | Fathom's operators | Used only for maintenance, never by the application |
| Database application account | Fathom's operators | Limited to what the application needs |
| Database migration account | Fathom's operators | Used only to apply migrations during upgrades |
| HTTPS private key | Fathom's operators, with the certificate issued by IT | Renewed before expiry |
| Session secret | Fathom's operators | Signs session cookies; changing it signs everyone out |
| Backup encryption key | To be decided; someone outside the team that runs backups | Old keys are kept for as long as backups made with them are kept, so those backups can still be restored |
| Fathom Administrator accounts | Each named Administrator | Personal accounts, not shared |
| Host administrator accounts | IT, under IT's own process | Personal accounts, not shared |
| Fathom's environment and service accounts | Fathom's operators | Limited to Fathom's named operators |

## Vulnerability Scanning

The aim is to scan every part of Fathom's technology. Coverage of some parts depends on the open questions below.

| What is scanned | When | Proposed tooling |
| --- | --- | --- |
| Application dependencies (npm packages) | Every build, and daily | pnpm audit and Trivy |
| Container images, both as built and as running | Every build, and daily | Trivy, scanning each image saved to a file for vulnerable operating system packages and built-in secrets. Trivy cannot see PostgreSQL itself, which is built from source; its releases are tracked through PostgreSQL's release notes and Renovate |
| Application source code | Every build | Semgrep |
| Secrets in the repository, including its history | Every build | Gitleaks |
| Docker and Compose configuration | Every build, and after any change | Trivy configuration scan for Dockerfiles; automated tests for Compose settings, which Trivy cannot scan |
| The running web application | Before each stage goes live, and monthly | A web application scanner such as OWASP ZAP |
| HTTPS configuration | Before each stage goes live, and monthly | A TLS configuration scanner |
| Host operating system and container runtime | Weekly, or on IT's existing schedule if more frequent | IT's existing host vulnerability scanner |
| The Linux environment inside any virtualization layer, such as WSL 2 | Weekly | IT's scanner if it can see inside it, otherwise a Linux package scanner |
| Exposure to the internet and the internal network | Monthly, and after any network change | External and internal port scans |
| The backup location | On IT's existing schedule | IT's existing scanning |
| Company build environments and developer machines | On IT's existing schedule | IT's existing endpoint scanning |
| Developer machines not managed by IT, which may run builds until the build process is decided | To be agreed | See the open questions |

**Fix times by severity:** critical within 7 days, high within 30 days, medium within 90 days, and low at the next planned update. Any exception is recorded with a reason and an expiry date, and approved by Fathom's owner.

**Exceptions:**

| Finding | Reason | Approved | Expires |
| --- | --- | --- | --- |
| Medium and low findings in the system libraries of the application's distroless base image, such as glibc and zlib, with no fix released by Debian | No fix exists. The image has no shell or package manager, runs as a user other than root with a read-only filesystem, and has no route out. Fixes arrive through base image updates, and the exception ends sooner if one does | 2026-10-30, by Fathom's owner | 2027-01-28 |

## Source Code Assurance

How IT and the company can be confident in Fathom's source code:

- **Open source:** Fathom is licensed under Apache 2.0, and IT will be given read access to its full source code.
- **AI-assisted development:** Fathom is built with an AI coding assistant, and each change is also reviewed by a separate AI agent. Fathom's owner is the human reviewer and approves every change before it is committed.
- **Development workflow:** Every change follows the [Workflow](../../AGENTS.md#workflow), which includes running the tests once code exists.
- **Planned from the first code:** Security tests for every role and data tier, and static analysis on every change.
- **Planned once the build process is decided:** Pinned dependency versions from trusted sources, a list of every component in each release (a software bill of materials), and tagged releases built in a repeatable way, so IT can match what is running to its source code.
- **Proposed once there is a shared repository:** A protected main branch and signed commits, in addition to the pull requests already required.

## Enforcing the Plan

The threat model is enforced by making each mitigation verifiable, and by checking regularly that it holds:

- **Every mitigation has a check:** Each row in the threat table names how it is verified.
- **Builds fail on security problems:** Once the build process is decided, a build fails if a security test fails or a scan finds a critical or high vulnerability without an approved exception.
- **Code review:** Every change is reviewed against this plan, as set out in the Security section of the [Code Review Standards](../standards/code-review.md).
- **Responsibilities and intervals:**
  - Fathom's operators review scan results weekly and track fixes against the fix times.
  - Fathom's owner approves exceptions.
  - Host and environment login, credentials, user accounts, and the access history are reviewed quarterly.
  - The threat model is reviewed before each stage of the [Roadmap](../product/roadmap.md) goes live, and at least once a year.
- **Self-review:** While Fathom's owner holds every role, reviews of the access history are self-reviews. A second reviewer is planned once someone else takes the Administrator role.
- **Records:** Each security report is written locally, as described in [Development Setup](../design/development-setup.md). Scan results, exceptions, and accepted risks are kept for at least one year, in a location agreed with IT.
- **Accepted risks:** Remaining risks are accepted by Fathom's owner, with IT's agreement.

## Open Questions

1. **Host scanning:** Which tool does IT already use for host vulnerability scanning, and can it see inside any virtualization layer and the container runtime?
1. **Fix times:** Are the proposed fix times by severity acceptable to IT?
1. **Build process:** Where will builds and scans run, and how will releases reach the server?
1. **Port scans:** Who runs the external and internal port scans?
1. **Developer machines not managed by IT:** How should they be protected and scanned while they run builds with fictional data only?
1. **Backup key holder:** Who outside the team that runs backups should hold the backup encryption key?
1. **Secret store:** Which password manager or secret store should hold Fathom's credentials?
1. **Endpoint protection:** Is IT's antivirus or endpoint protection compatible with the container runtime and any virtualization layer on the host?
