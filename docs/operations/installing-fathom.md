# Fathom: Installing Fathom

**Last updated:** 2026-11-19

How to install Fathom on a host, through to the first Administrator's sign-in. [Supported Platforms](supported-platforms.md) says which hosts Fathom runs on, and [Securing Your Environment](securing-your-environment.md) what whoever runs it must secure. Fathom has no published release images yet, so the host builds the images from Fathom's source; installing from published images is [issue #327](https://github.com/ribbitworks/fathom/issues/327).

## Prerequisites

- A host [Supported Platforms](supported-platforms.md#server-platforms) lists, with Docker Engine and Docker Compose, `git` and `openssl`.
- An account on the host to run Fathom, one that can run Docker. Run every step below as that account.
- An HTTPS certificate, with any intermediate certificates, and its private key, whose name matches the address users will type, as [Securing Your Environment](securing-your-environment.md#certificates-and-secrets) sets out.
- The email address of the person who will first sign in as Administrator.

## Steps

1. Get Fathom's source and open a terminal in it:

   ```sh
   git clone https://github.com/ribbitworks/fathom.git
   cd fathom
   ```

   Check out the release to install, such as `git checkout v0.1.0`, or stay on the default branch while Fathom has no release.

1. Make a folder for the secrets that only this account can open, such as `/srv/fathom/secrets`. Making a folder under `/srv` needs `sudo`, so give it to this account as it is made:

   ```sh
   sudo install -d -m 700 -o "$USER" /srv/fathom /srv/fathom/secrets
   ```

1. Fill the folder with a random password for each of the database's three accounts and a session secret:

   ```sh
   for name in postgres_superuser_password fathom_migrator_password fathom_app_password fathom_auth_secret; do
     openssl rand -hex 32 >"/srv/fathom/secrets/$name"
   done
   ```

1. Copy the certificate and its private key into the same folder, as `fathom_tls_cert.pem` and `fathom_tls_key.pem`.
1. Make every file in the folder readable by all, as the containers read them as their own users; the folder itself keeps them private:

   ```sh
   chmod 644 /srv/fathom/secrets/*
   ```

1. Copy the host's settings into place, `cp deploy/compose.env.example deploy/.env`, and set each in `deploy/.env`, as its comments describe:
   - `FATHOM_BIND_ADDRESS` and `FATHOM_HTTPS_PORT`: the address and port users reach.
   - `FATHOM_PUBLIC_URL`: the address users type, matching the certificate.
   - `FATHOM_SECRETS_DIR`, `FATHOM_TLS_CERT` and `FATHOM_TLS_KEY`: the folder and files above.
   - `FATHOM_VERSION`, `FATHOM_COMMIT` and `FATHOM_COMMIT_DATE`, which Help's About box shows: the release, such as `0.1.0`, or empty on the default branch; and what `git log -1 --format=%h` and `git log -1 --format=%cs` print.
1. Build the images and start Fathom, waiting until it's ready:

   ```sh
   docker compose --file deploy/compose.yaml up --detach --build --wait
   ```

   The first build takes several minutes, and longer on a host whose processor isn't x86-64, which builds the linux/amd64 images by emulation.

1. Check that it's running with `docker compose --file deploy/compose.yaml ps`: `proxy`, `app` and `postgres` are listed as up and healthy, and only `proxy` publishes a port on the host, on `FATHOM_BIND_ADDRESS` and `FATHOM_HTTPS_PORT`.
1. Create the first Administrator, named Fathom Administrator, with the email address of the person who will sign in:

   ```sh
   docker compose --file deploy/compose.yaml run --rm --no-deps app apps/server/src/create-administrator.ts --email <address>
   ```

   It prints the account's password once. Running it again changes nothing once an account holds the Administrator role.

1. Give that password to the person whose address it is, to sign in at `FATHOM_PUBLIC_URL`. Fathom asks them for a new password before anything else.

## Verification

- The address in `FATHOM_PUBLIC_URL` opens the **Sign in** page, with no warning about the certificate.
- The Administrator signs in, changes the password, and Fathom opens on the **Accounts** page.

## Stopping and Updating

- **Stopping:** `docker compose --file deploy/compose.yaml down` stops Fathom and keeps its data in the `fathom_postgres-data` volume. `up --detach --wait` starts it again.
- **Updating:** check out the new release, set a newer `FATHOM_SECURITY_FIXES_DATE` and the version settings in `deploy/.env`, as [Securing Your Environment § Updates](securing-your-environment.md#updates) sets out, then run the build and start step again; migrations run before the application starts.
- **After installing:** secure the host, the network, backups and accounts as [Securing Your Environment](securing-your-environment.md) sets out, starting with giving the Administrator role to a named person.
