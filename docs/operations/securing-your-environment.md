# Fathom: Securing Your Environment

**Last updated:** 2026-11-26

What Fathom can't secure for itself, and recommendations for securing it. The [Security Plan](../security/security-plan.md) covers what it does; everything below is up to whoever runs it. Settings named here are in `deploy/compose.env.example`, and [Installing Fathom](installing-fathom.md) sets out the installation itself.

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

- **The first administrator:** Once Fathom is running, create the Fathom Administrator account as [Installing Fathom](installing-fathom.md#steps) sets out. It prints a password once, which must be changed at first sign-in. Then give the Administrator role to a named person, and stop using that shared account.
- **Roles:** Give each account only the roles its user needs. Anyone who manages accounts can give themselves any role.
- **Separate duties:** Running Fathom, such as backups and updates, needs no Fathom account, so those who run it need no role that sees people's data.
- **The access history:** Review it for changes marked worth checking, such as accounts created and roles changed.
- **People who leave:** Deactivate their accounts.

## On Windows 11 With WSL2

Windows 11 with WSL2 runs Fathom inside a Linux distro in a virtual machine, as [Architecture](../design/architecture.md#on-windows-11-with-wsl2) shows. Everything above applies inside the distro.

These steps cover Windows around it. They are commands to run in PowerShell opened as administrator, since Fathom has no Windows scripts.

On Windows Server, run Fathom in a Linux virtual machine instead, and secure it as any Linux host.

- **Install:** on Windows 11 22H2 or later, run `wsl --install` and restart. Install Docker Engine inside the distro, following Docker's instructions for it, never Docker Desktop.
- **Use mirrored networking:** set `networkingMode=mirrored` under `[wsl2]` in the `.wslconfig` file of the Windows user that owns the distro. The distro then shares Windows' addresses, so each user's own address reaches Fathom. Set `FATHOM_BIND_ADDRESS` to the address users reach.
- **Allow only Fathom's port:** through the Hyper-V firewall, only from the users' network, never all inbound connections: `New-NetFirewallHyperVRule -Name "Fathom" -DisplayName "Fathom" -Direction Inbound -VMCreatorId '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -Protocol TCP -LocalPorts <port> -RemoteAddresses <users' network>`.
- **Keep it running:** WSL2 shuts a distro down when it has been idle for 15 seconds, and starts none when Windows starts.
  - In the same `.wslconfig` file, set `instanceIdleTimeout=-1` under `[general]`, so it keeps running.
  - Start it when Windows starts, with a Task Scheduler task at startup that runs `wsl.exe -d <distro> --exec /bin/true` as that user, even when they aren't signed in.
  - After a restart, check that Fathom answers.
- **Limit who can open the distro:** anyone who can sign in as the Windows user that owns it can open it as root with `wsl`, and Windows administrators can mount its virtual disk. Either can read Fathom's data and secrets, so give that access only to the people who run Fathom.
- **Encrypt the distro's disk:** its virtual disk, holding the database and secrets, is a file under `%LocalAppData%\wsl` by default. Turn on BitLocker for that drive, or Device Encryption on Windows 11 Home.
- **Keep it patched:** update Windows, WSL itself with `wsl --update`, and the distro's packages.

## Updates

- **Run the latest release:** Each release's images are scanned before they're published, and a server runs only those, never images built on it. Update to each new release as it comes out, as [Installing Fathom § Stopping and Updating](installing-fathom.md#stopping-and-updating) sets out.

## What Leaves Fathom

- **Exports:** A file exported from Fathom leaves its protection. The browser has an export of Personal or Confidential data recorded, with who exported it and which columns, but a changed browser or a script can skip that.
- **Logs:** Fathom's logs hold each request's network address. Keep them only as long as needed.
- **Links:** A page's address holds what was searched for, so it stays in browser history and in any link that is shared.
