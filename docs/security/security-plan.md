# Fathom: Security Plan

**Last updated:** 2026-11-14

How Fathom guards against threats as it ships: its code, its container images and its Compose configuration. The machine, network, certificates, secrets and backups around it come from whoever runs it, as [Securing Your Environment](../operations/securing-your-environment.md) sets out. [How Data Is Safeguarded](../privacy/data-protection.md) covers who sees which data, and the [Security Policy](../../SECURITY.md) how to report a vulnerability.

## Threats and Mitigations

The threat model groups threats by STRIDE: spoofing, tampering, repudiation, information disclosure, denial of service and elevation of privilege. It covers Fathom as it ships. Threats to the machine and network around it are for whoever runs Fathom.

### Trust Boundaries

- **Browser to proxy:** HTTPS, over a network Fathom doesn't control. In Fathom's Compose configuration, only the proxy publishes a port.
- **Proxy to application:** The proxy passes HTTPS traffic on without decrypting it, and holds no certificate.
- **Application to database:** An internal network with no route out, which the proxy isn't on.
- **The machine:** Anyone with administrator access to the machine Fathom runs on can reach its data and secrets. Fathom can't prevent that.

### Spoofing

- **Signing in as someone else:** Passwords must meet the rules set in Settings and not be easy to guess, and are hashed with scrypt, Better Auth's default. Sign-in attempts are rate-limited, and a session ends after 30 minutes without use.
- **Stolen or forged sessions:** Session cookies are Secure, HttpOnly and SameSite, and requests are checked against cross-site forgery.
- **Posing as the proxy:** The application accepts connections, and the user addresses they name, only from the proxy.
- **Taking a colleague's name:** A user can't take a name another account has, ignoring letter case, and names that differ only in invisible characters are refused. The audit log shows each account's email address beside its name.

### Tampering

- **Injection:** Database queries are parameterized, output is encoded, and input is checked by shared schemas. A content security policy allows scripts only from Fathom's own files.
- **Stored content:** Web links accept only http and https addresses, and notes only an allowlist of formats.
- **The audit log:** The database refuses any change to or deletion of the access history. The change history can only be added to, apart from marking a change published.
- **The schema:** The application's database role can only read and write data, and a separate role changes the schema.
- **Undoing:** Only the user who made a change can undo it, and not once anything it would change has changed again.
- **Dependencies:** Packages are installed from the lockfile exactly, base images are pinned by digest and GitHub Actions by commit, and Renovate proposes updates.

### Repudiation

- **Changes:** The change history records every change, with who made it, the role they acted as, and when.
- **Access:** The access history records views of Personal and Confidential data, sign-ins, changes to accounts, roles and classifications, and exports of Personal or Confidential data.
- **Requests:** Requests are logged by method, path and network address.

### Information Disclosure

- **Before sign-in:** Only the front end's files, sign-in and the session check are served without a signed-in account.
- **Data beyond a role:** One shared data access layer checks permissions and classifications for every page, export and search. A page, view or column is shown only to roles that see every classification it needs.
- **Drafts and history:** Drafts, unpublished changes and the change history go through the same checks. Unpublished changes are seen only by their maker.
- **Exports:** An exported file holds only what the role was sent, and saving one with Personal or Confidential data is recorded.
- **Logs and errors:** Logs leave out database error messages and known sensitive fields, though a path can name a record's ID. Errors shown to users are generic.
- **Leaving the machine:** The application and database containers have no route out.
- **At rest:** The database isn't encrypted at rest; [ADR 0012](../adr/0012-encryption-at-rest.md) leaves that to the disk.
- **Secrets:** Secrets are kept out of the repository and container images.
- **Development:** Development uses fictional data only. Its accounts are on the reserved `fathom.test` domain, and the release images don't hold them.
- **The release:** Accepted: the page served before sign-in names Fathom's release, so anyone who reaches it can look up known weaknesses. They're fixed by updating, not hidden.

### Denial of Service

- **Too many requests:** The proxy limits connections, and the server limits each client's requests and how long a request may take.
- **Resource exhaustion:** Every container has memory and process limits.
- **Locking out administrators:** At least one active account can always administer accounts.

### Elevation of Privilege

- **Granting oneself access:** Anyone who manages accounts could give themselves any role, so every change to accounts and roles is recorded in the access history and marked for review.
- **Acting with several roles:** A session acts as one role at a time, with only that role's permissions.
- **Approving one's own change:** Nobody approves their own change unless their role is given that permission.
- **Escaping a container:** Every container runs as a user other than root, with a read-only filesystem, all Linux capabilities dropped and no privilege escalation. The application's runtime image is distroless.
- **The database:** Passwords are stored with SCRAM-SHA-256, and the database refuses superuser logins over the network.

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
