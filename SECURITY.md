# Security Policy

This policy covers Fathom's code, container images and Compose configuration in this repository. The machine and network Fathom runs on are for whoever runs it to secure, as [Securing Your Environment](docs/operations/securing-your-environment.md) sets out.

## Reporting a Vulnerability

Report a vulnerability privately, through GitHub's private vulnerability reporting: on the repository's **Security** tab, select **Report a vulnerability**. Never report one in an issue, a pull request or a discussion, since those are public.

A useful report says:

- what the vulnerability is, and what someone could do with it
- the steps to reproduce it, on Fathom's fictional development data
- the version or commit it was found in

Reports are read by the maintainer, who replies in the report's own thread on GitHub.

## Supported Versions

Fathom is in early development and has no supported versions before 1.0. Fixes are made on `main` only.

## How Fathom Is Kept Secure

The [Security Plan](docs/security/security-plan.md) sets out the threats Fathom guards against, and how its code and images are scanned.
