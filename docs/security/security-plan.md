# Fathom — Security Plan

**Status:** Proposal for review by the owner and IT
**Last updated:** 2026-10-26

How Fathom is protected: what it must protect, the threats against it, how each threat is mitigated and verified, how its technology is scanned for vulnerabilities, how confidence in its source code is established, and how the plan is enforced. It builds on [ADR 0001](../adr/0001-tech-stack.md), the [Decisions Log](../product/decisions.md), and [Roles](../product/roles.md). Everything here is proposed until reviewed.

## Assets

- **Employee personal information:** General, Restricted, and Confidential data, including the hiring plan.
- **User accounts:** Credentials, sessions, and role assignments.
- **Access history:** The record of who viewed or changed sensitive data.
- **Secrets:** The database password, the HTTPS private key, and the backup encryption key.
- **Backups**
- **The server:** The Windows Server host, the WSL 2 Linux environment, Docker, and Fathom's containers.
- **Source code, dependencies, and the build process**

## Trust Boundaries

- **Users to Fathom:** Browsers on the internal network connect to Fathom over HTTPS.
- **Internet and Fathom:** Fathom must not be reachable from the internet. The server has outbound internet access, which Fathom's containers must not use at runtime.
- **Fathom to its database:** The application container talks to the database container on a private Docker network.
- **Server operators to Fathom's data:** People who can log in to the server or run Docker can reach the database directly, outside Fathom's role checks.
- **Host to containers:** The Windows host runs WSL 2, which runs Docker and the containers.
- **Backups leaving the server:** Encrypted backups are copied to an approved location.
- **Code entering the server:** Source code, dependencies, and container images are built and brought onto the server through a build process still to be decided.

## Threats and Mitigations

| Threat | Mitigation | How it is verified |
| --- | --- | --- |
| Someone on the internet reaches Fathom | Fathom's port is open only to the internal network; the host firewall blocks inbound internet traffic | External port scan |
| Other services on the server are reachable from the internal network | Only Fathom's HTTPS port is exposed; the database port is never published | Internal port scan |
| A compromised component sends data to the internet | Outbound traffic from Fathom's containers is blocked at runtime; downloads happen only during controlled updates from approved sources | Test from inside each container that outbound connections fail |
| Someone on the internal network without an account reaches data | Every request requires sign-in; no anonymous access | Automated tests |
| A user sees or changes data beyond their roles | Tier checks in one shared data access layer, used by screens, exports, snapshots, and search | Automated tests for every role and tier; code review |
| A user grants themselves more access | Administrators cannot assign roles to themselves; role changes are recorded in the access history | Automated tests; access history review |
| Passwords are guessed or stolen | Strong password hashing, sign-in rate limiting, and session expiry | Automated tests; configuration review |
| Sessions are hijacked, or requests forged from another site | Secure, HttpOnly, SameSite session cookies and cross-site request forgery protection | Automated tests; web application scan |
| Traffic is intercepted on the internal network | HTTPS with an internal certificate; no unencrypted access | TLS configuration scan |
| Injection attacks, such as SQL injection or cross-site scripting | Parameterized queries, output encoding, and input validation with shared schemas | Automated tests; static analysis; web application scan |
| Server operators read the database directly | Server login limited to named people; database credentials stored as secrets. The remaining risk is accepted and recorded | Review of who has server login |
| The access history is altered or deleted | Access history can only be added to; no role can edit or delete it | Automated tests |
| Secrets leak | Secrets are kept out of the repository and container images | Secret scanning |
| A vulnerable or malicious dependency or container image | Pinned versions from trusted sources; dependency and image scanning | Scans on every build and on a schedule |
| The build environment or a developer machine is compromised | Builds come from a known environment, each release is tagged and built repeatably, and releases are compared with their source | Release verification |
| An unpatched host, WSL environment, Docker, or database | Regular patching of every layer | Host and container vulnerability scans |
| Personal data leaks through logs or error messages | Personal data kept out of logs; generic error messages to users | Code review; log review |
| Backups are stolen or read | Encrypted backups, with the key held by someone other than the backup operator | Restore tests; key custody check |
| A former user keeps access | Accounts are disabled when users leave | Account review |
| Real data leaks into development | Fictional data only in development; real data never committed | Code review; repository scanning |
| Fathom is overwhelmed with requests | Resource limits on containers and request rate limiting | Configuration review |

## Vulnerability Scanning

The aim is to scan every part of Fathom's technology. Coverage of some parts depends on the open questions below.

| What is scanned | When | Proposed tooling |
| --- | --- | --- |
| Application dependencies (npm packages) | Every build, and daily | A dependency scanner such as npm audit or Trivy |
| Container images, both as built and as running | Every build, and daily | A container image scanner such as Trivy or Grype |
| Application source code | Every build | Static analysis for common security flaws |
| Secrets in the repository | Every build | A secret scanner |
| Docker and Compose configuration | Every build, and after any change | A configuration scanner, such as a Trivy configuration scan or the CIS Docker benchmark |
| The running web application | Before each stage goes live, and monthly | A web application scanner such as OWASP ZAP |
| HTTPS configuration | Before each stage goes live, and monthly | A TLS configuration scanner |
| Windows Server host and Docker | Weekly, or on IT's existing schedule if more frequent | IT's existing host vulnerability scanner |
| The WSL 2 Linux environment's packages | Weekly | IT's scanner if it can see inside WSL, otherwise a Linux package scanner |
| Exposure to the internet and the internal network | Monthly, and after any network change | External and internal port scans |
| The backup location | On IT's existing schedule | IT's existing scanning |
| The build environment and developer machines | On IT's existing schedule | IT's existing endpoint scanning |

**Fix times by severity:** critical within 7 days, high within 30 days, medium within 90 days, and low at the next planned update. Any exception is recorded with a reason and an expiry date, and approved by the Director.

## Source Code Assurance

How IT and the company can be confident in Fathom's source code:

- **Open source:** Fathom is licensed under Apache 2.0, and IT will be given read access to its full source code.
- **AI-assisted development:** Fathom is built with an AI coding assistant, and each change is also reviewed by a separate AI agent. The Director, as Fathom's owner, is the human reviewer and approves every change before it is committed.
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
  - The Director approves exceptions.
  - Server login, user accounts, and the access history are reviewed quarterly.
  - The threat model is reviewed before each stage of the [Roadmap](../product/roadmap.md) goes live, and at least once a year.
- **Self-review:** While the Director holds every role, reviews of the access history are self-reviews. A second reviewer is planned once someone else takes the Administrator role.
- **Records:** Scan results and exceptions are kept for at least one year, in a location agreed with IT.

## Open Questions

1. **Host scanning:** Which tool does IT already use for host vulnerability scanning, and can it see inside the WSL 2 environment and Docker?
1. **Fix times:** Are the proposed fix times by severity acceptable to IT?
1. **Build process:** Where will builds and scans run, and how will releases reach the server?
1. **Port scans:** Who runs the external and internal port scans?
1. **Endpoint protection:** Is IT's antivirus or endpoint protection compatible with WSL 2 and Docker on the server?
