# Fathom: Security Plan

**Last updated:** 2026-11-14

The threats Fathom guards against as it ships: its code, its container images and its Compose configuration. The machine, network, certificates, secrets and backups around it come from whoever runs it, as [Securing Your Environment](../operations/securing-your-environment.md) sets out. [How Data Is Safeguarded](../privacy/data-protection.md) covers who sees which data, and the [Security Policy](../../SECURITY.md) how to report a vulnerability.

## Threats and Mitigations

- **Network:** In Fathom's Compose configuration, only the proxy publishes a port, and it passes HTTPS traffic on without decrypting it. The application and database containers are on internal networks with no route out. The proxy limits connections, and the server limits each client's requests and how long a request may take.
- **Sign-in:** Every request needs a signed-in account. Passwords must meet the rules set in Settings and not be easy to guess, and are hashed with scrypt. Sign-in attempts are rate-limited, and a session ends after 30 minutes without use.
- **Sessions:** Session cookies are Secure, HttpOnly and SameSite, and requests are checked against cross-site forgery.
- **Responses:** The server sends a content security policy that allows scripts only from Fathom's own files, along with HSTS and other security headers.
- **Access:** One shared data access layer checks permissions and classifications for every page, export and search. A session acts as one role at a time.
- **Administrators:** Anyone who manages accounts could give themselves any role, so every change to accounts and roles is recorded in the audit log and marked for review. At least one active account can always administer accounts.
- **Approval:** Nobody approves their own change unless their role is given that permission.
- **Injection:** Database queries are parameterized, output is encoded, and input is checked by shared schemas. Web links accept only http and https addresses, and notes only an allowlist of formats.
- **Audit log:** The database refuses any change to or deletion of the access history. The change history can only be added to, apart from marking a change published.
- **Database:** The application's database role can only read and write data, and a separate role changes the schema. Passwords are stored with SCRAM-SHA-256, and the database refuses superuser logins over the network. The database isn't encrypted at rest; [ADR 0012](../adr/0012-encryption-at-rest.md) leaves that to the disk.
- **Containers:** Every container runs as a user other than root, with a read-only filesystem, all Linux capabilities dropped, no privilege escalation, and memory and process limits. The application's runtime image is distroless.
- **Logs and errors:** Requests are logged by method, path and network address only, database errors without their messages, and known sensitive fields are redacted. A path can still name a record's ID. Errors shown to users are generic.
- **Dependencies:** Packages are installed from the lockfile exactly, base images are pinned by digest and GitHub Actions by commit, and Renovate proposes updates.
- **Secrets:** Secrets are kept out of the repository and container images.
- **Development:** Development uses fictional data only. Its accounts are on the reserved `fathom.test` domain, and the release images don't hold them.
- **Machine administrators:** Anyone with administrator access to the machine Fathom runs on can reach its data and secrets. Fathom can't prevent that.

## Vulnerability Scanning

- **The security report:** `pnpm security` scans dependencies (pnpm audit and Trivy), source code (Semgrep), secrets in the repository and its history (Gitleaks), Dockerfiles (Trivy), the Compose settings (automated tests), and the container images (Trivy) whenever anything they're built from has changed. `pnpm check` runs it.
- **Releases:** Publishing a release scans its images first.
- **Fix times:** Counted from when a fix is released: critical within 14 days, high within 60, medium within 180, and low at the next planned update.
- **Failing:** The security report fails on an overdue fix, any other critical or high finding, or a scan that doesn't finish. A release isn't published while any fix in its images is overdue.
- **Exceptions:** An overdue finding that can't be fixed yet may be excepted, with a reason, an expiry date and the maintainer's approval, in `.trivyignore.yaml`. None is approved today.

## Source Code Assurance

- **Open source:** Fathom is licensed under Apache 2.0.
- **Standards:** Code is written to the [core principles](../standards/shared/core-principles.md) and the [TypeScript](../standards/shared/typescript/typescript.md) and [shell](../standards/shared/shell/shell.md) standards, and reviewed against the [Code Review Standards](../standards/shared/code-review.md#security-and-data) and [Fathom's security focus](../standards/code-review.md#security).
- **Tests:** [Access control tests](../standards/testing.md#access-control-tests) cover every role and classification, alongside [security tests](../standards/testing.md#security-tests) and static analysis, as the [Testing Standards](../standards/shared/testing.md) set out.
- **Releases:** Each release is tagged, and its images are built from that tag and labelled with its source and commit, as [ADR 0011](../adr/0011-releases-and-images.md) sets out.
