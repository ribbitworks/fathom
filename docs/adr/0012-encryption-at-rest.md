# Encryption at Rest

- **ADR:** 0012
- **Status:** Accepted
- **Date:** 2026-11-14

## Context

Fathom's database holds Personal and Confidential data. PostgreSQL, as Fathom ships it, doesn't encrypt its data files; that feature exists only in some commercial distributions. Fathom's Compose configuration keeps the database in a Docker volume, which is encrypted only if the disk under it is.

## Options

- **Leave it to the disk:** whoever runs Fathom encrypts the disk or volume it stores data on, with full-disk encryption on the machine or an encrypted volume from a cloud provider.
- **Encrypt sensitive columns in Fathom:** encrypt Personal and Confidential values with `pgcrypto` or in the application.
- **Refuse an unencrypted volume:** check the disk at start-up and refuse to run on one that isn't encrypted.

## Decision

Encryption at rest is left to the disk, and the [Securing Your Environment](../operations/securing-your-environment.md) guide asks for it. Decided by the maintainer on 2026-11-14.

Encrypting columns in Fathom stops the database from searching, filtering and sorting them, makes every query that reads them more complex, and needs a key the server can read, usually kept on the same machine, which protects little against someone who has the machine. Fathom can't reliably tell whether the disk under a Docker volume is encrypted, so it can't refuse one.

## Consequences

- **One layer covers everything:** disk encryption protects the database, logs, backups written to the same disk, and Docker's own files alike.
- **Fathom can't check it:** a disk left unencrypted is a gap Fathom can't see, so the [Security Plan](../security/security-plan.md) states it as up to whoever runs Fathom.
- **No cost in Fathom's code:** queries, search and sorting stay as they are.
