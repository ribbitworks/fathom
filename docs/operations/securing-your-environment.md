# Fathom: Securing Your Environment

**Last updated:** 2026-11-17

What Fathom can't secure for itself, and recommendations for securing it. The [Security Plan](../security/security-plan.md) covers what it does; everything below is up to whoever runs it. Settings named here are in `deploy/compose.env.example`.

## The Machine

- **Encrypt the disk:** Fathom's database isn't encrypted at rest, as [ADR 0012](../adr/0012-encryption-at-rest.md) sets out. Use full-disk encryption, or an encrypted volume, for the disk that holds Docker's volumes.
- **Limit administrators:** Anyone with administrator access to the machine, or who can run Docker on it, can read Fathom's database and secrets. Give that access only to the people who run Fathom, and keep other applications off the machine where possible.
- **Keep it patched:** Update the operating system, any virtualization layer, and the container runtime.

## The Network

- **Publish one port:** Only the proxy publishes a port, on `FATHOM_BIND_ADDRESS` and `FATHOM_HTTPS_PORT`. Bind it to the address users reach, and use a firewall to limit who can reach it.
- **Keep the database private:** Never publish the database's port.
- **Block outbound traffic:** The application and database containers have no route out. Where the container runtime allows it, block the proxy's outbound traffic too.

## Certificates and Secrets

- **Use a trusted certificate:** Set `FATHOM_TLS_CERT` and `FATHOM_TLS_KEY` to a certificate whose name matches `FATHOM_PUBLIC_URL`, and renew it before it expires.
- **Generate the secrets:** Fill `FATHOM_SECRETS_DIR` with random passwords for the database's three accounts and a session secret of at least 32 random characters, one file each. Never reuse the development secrets.
- **Protect the folder:** The files must be readable by all (mode 644), so keep them in a folder only the account that runs Fathom can open, with the certificate's private key.
- **Keep master copies elsewhere:** Store each secret in a password manager or secret store. The database's passwords are set when its data is first created, so changing one later means changing it in PostgreSQL too. Changing the session secret signs everyone out.

## Backups

- **Make them:** Fathom doesn't make backups. Back up the database regularly, such as with `pg_dump`.
- **Encrypt them:** Encrypt every backup, and keep its key apart from the people who run the backups.
- **Test them:** Restore a backup now and then, to know it works.

## Accounts

- **The first administrator:** Once Fathom is running, create the Fathom Administrator account with `docker compose --file deploy/compose.yaml run --rm --no-deps app apps/server/src/create-administrator.ts --email <address>`. It prints a password once, which must be changed at first sign-in. Then give the Administrator role to a named person, and stop using that shared account.
- **Roles:** Give each account only the roles its user needs. Anyone who manages accounts can give themselves any role.
- **The access history:** Review it for changes marked worth checking, such as accounts created and roles changed.
- **People who leave:** Deactivate their accounts.

## Updates

- **Run the latest release:** Each release's images are scanned before they're published. Update to each new release as it comes out.
- **Images built on the machine:** Set `FATHOM_SECURITY_FIXES_DATE` to a newer date to fetch the latest operating system fixes when rebuilding.

## What Leaves Fathom

- **Exports:** A file exported from Fathom leaves its protection. The browser has an export of Personal or Confidential data recorded, with who exported it and which columns, but a changed browser or a script can skip that.
- **Logs:** Fathom's logs hold each request's network address. Keep them only as long as needed.
- **Links:** A page's address holds what was searched for, so it stays in browser history and in any link that is shared.
