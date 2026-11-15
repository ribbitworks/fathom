# Fathom: Security Plan

**Last updated:** 2026-11-15

How Fathom guards against threats as it ships: its code, its container images and its Compose configuration. The machine, network, certificates, secrets and backups around it come from whoever runs it, as [Securing Your Environment](../operations/securing-your-environment.md) sets out. [How Data Is Safeguarded](../privacy/data-protection.md) covers who sees which data, and the [Security Policy](../../SECURITY.md) how to report a vulnerability.

## Threats and Mitigations

The threat model groups threats by STRIDE: spoofing, tampering, repudiation, information disclosure, denial of service and elevation of privilege. It covers Fathom as it ships. Threats to the machine and network around it are for whoever runs Fathom.

### Trust Boundaries

- **Browser to proxy:** HTTPS, over a network Fathom doesn't control. In Fathom's Compose configuration, only the proxy publishes a port.
- **Proxy to application:** The proxy passes HTTPS traffic on without decrypting it, and holds no certificate.
- **Application to database:** An internal network with no route out, which the proxy isn't on.
- **The machine:** Anyone with administrator access to the machine Fathom runs on can reach its data and secrets. Fathom can't prevent that.

### Spoofing

- **Signing in as someone else:** Passwords must meet the rules set in Settings and not be easy to guess, and are hashed with scrypt, Better Auth's default. Each client address may try to sign in 5 times a minute, and every refused sign-in gets the same answer. Accepted: there is no lockout for an account, and failed sign-ins aren't recorded.
- **Stolen or forged sessions:** Session cookies are Secure, HttpOnly and SameSite, and requests are checked against cross-site forgery. Each sign-in gets a new session, and a session ends after 30 minutes without use. A password change, an administrator's reset or a deactivation ends the account's other sessions. Accepted: a session in use has no absolute end.
- **Resetting a password:** There is no self-service reset; only administrators reset passwords, and each reset is recorded in the access history.
- **Posing as the proxy:** The application accepts connections, and the user addresses they name, only from the proxy.
- **Taking a colleague's name:** A user renaming themselves can't take a name another account has, ignoring letter case, and some invisible characters are refused. The access history shows each account's email address beside its name.

### Tampering

- **Injection:** Database queries are parameterized, output is encoded, and input is checked by shared schemas, which drop fields they don't name. A content security policy allows scripts only from Fathom's own files.
- **Stored content:** Web links accept only http and https addresses, and notes only an allowlist of formats.
- **Framing and redirects:** Other sites can't frame Fathom's pages, and sign-in takes no address to send the user on to.
- **The audit log:** The database refuses the application's role any change to or deletion of the access history. The change history can only be added to, apart from marking a change published. The migration role, used only for upgrades, owns both.
- **The schema:** The application's database role can only read and write data, and a separate role changes the schema.
- **Undoing:** Only the user who made a change can undo it, and not once anything it would change has changed again.
- **Dependencies:** Packages are installed from the lockfile exactly, and base images are pinned by digest and GitHub Actions by commit. Image builds also install the operating system's security fixes released by `FATHOM_SECURITY_FIXES_DATE`. Accepted: release images aren't signed and come with no list of their components.

### Repudiation

- **Changes:** The change history records every change, with who made it, the role they acted as, and when.
- **Access:** The access history records sign-ins, changes to accounts, roles and classifications, and exports of Personal or Confidential data. Views of Personal and Confidential data are recorded at most once a day for each user, without what was seen.
- **Requests:** Requests are logged by method, path and network address.

### Information Disclosure

- **Before sign-in:** Only the front end's files, sign-in, sign-out, changing a password and the session checks are served without a signed-in account. The front end's script names Fathom's release. Accepted: anyone who reaches it can look up the release's known weaknesses, which are fixed by updating, not hidden.
- **Data beyond a role:** One shared data access layer checks permissions and classifications for every page, export and search. A page, view or column is shown only to roles that see every classification it needs, and a column that needs a permission as well, such as People's Feature teams, which needs View on Feature teams, only to roles that hold it.
- **Drafts and history:** Drafts, unpublished changes and the change history go through the same checks. Unpublished changes are seen only by their maker.
- **Exports:** An exported file holds only what the role was sent. The browser asks the server to record an export of Personal or Confidential data before saving it. Accepted: a changed browser or a script can save the data without the record, as it could copy it from the screen.
- **Logs and errors:** Logs leave out database error messages and known sensitive fields, though a path can name a record's ID. Server errors shown to users are generic.
- **Outside services:** Fathom calls no outside service and loads nothing from the internet, such as fonts or scripts, so it needs no internet access to run. The application and database containers have no route out.
- **At rest:** The database isn't encrypted at rest; [ADR 0012](../adr/0012-encryption-at-rest.md) leaves that to the disk. Accepted: traffic between the application and the database isn't encrypted, since it stays on an internal network, and session tokens are stored as they are, along with each session's address and browser.
- **Secrets:** Secrets are kept out of the repository and container images.
- **Development:** Development uses fictional data only. Its accounts are on the reserved `fathom.test` domain, and the release images don't hold them.

### Denial of Service

- **Too many requests:** The proxy limits connections in total, and the server limits each client's requests and how long a request may take.
- **Resource exhaustion:** Every container has memory and process limits. Accepted: there are no processor limits.
- **Locking out administrators:** At least one active account can always administer accounts.

### Elevation of Privilege

- **Granting oneself access:** Anyone who manages accounts could give themselves any role, or reset a user's password and sign in as them. Every change to accounts and roles is recorded in the access history, and accounts created, changes to roles, and changes to which roles an account holds are marked for review.
- **Acting with several roles:** A session acts as one role at a time, with only that role's permissions.
- **Approving one's own change:** Nobody approves their own change unless their role is given that permission.
- **Escaping a container:** Every container runs as a user other than root, with a read-only filesystem, all Linux capabilities dropped and no privilege escalation. The application's runtime image is distroless.
- **The database:** Passwords are stored with SCRAM-SHA-256, and the database refuses superuser logins over the network.

## Vulnerability Scanning

- **The security report:** `pnpm security` scans dependencies (pnpm audit and Trivy), source code (Semgrep), secrets in the repository and its history (Gitleaks), Dockerfiles (Trivy), and the container images (Trivy) whenever anything they're built from has changed. `pnpm check` runs it, along with tests of the Compose settings.
- **Releases:** Publishing a release scans its images first.
- **Fix times:** Counted from when a fix is released: critical within 14 days, high within 60, and medium within 180. Low findings have no deadline.
- **Failing:** The security report fails on an overdue fix, any other critical or high finding, or a scan that doesn't finish. A release isn't published while any fix in its images is overdue.
- **Exceptions:** An overdue finding that can't be fixed yet may be excepted, with a reason, an expiry date and the maintainer's approval, in `.trivyignore.yaml`.

## Source Code Assurance

- **Open source:** Fathom is licensed under Apache 2.0.
- **Standards:** Code is written to the [core principles](../standards/shared/core-principles.md) and the [TypeScript](../standards/shared/typescript/typescript.md) and [shell](../standards/shared/shell/shell.md) standards, and reviewed against the [Code Review Standards](../standards/shared/code-review.md#security-and-data) and [Fathom's security focus](../standards/code-review.md#security).
- **Tests:** [Access control tests](../standards/testing.md#access-control-tests) cover every role and classification, alongside [security tests](../standards/testing.md#security-tests) and static analysis, as the [Testing Standards](../standards/shared/testing.md) set out.
- **Releases:** Each release is tagged, and its images are built from that tag and labelled with its source and commit, as [ADR 0011](../adr/0011-releases-and-images.md) sets out.
