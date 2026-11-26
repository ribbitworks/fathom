# Fathom: Installing Fathom

**Last updated:** 2026-11-26

How to install Fathom on a host, through to the first Administrator's sign-in, from a release's published images. The host builds nothing: it runs the images the release scanned and published. [Supported Platforms](supported-platforms.md) says which hosts Fathom runs on, and [Securing Your Environment](securing-your-environment.md) what whoever runs it must secure.

## Prerequisites

- A host [Supported Platforms](supported-platforms.md#server-platforms) lists, with Docker Engine and Docker Compose, `curl` and `openssl`, that can reach `ghcr.io` and `raw.githubusercontent.com` over HTTPS.
- An account on the host to run Fathom, one that can run Docker. Run every step below as that account.
- An HTTPS certificate, with any intermediate certificates, and its private key, whose name matches the address users will type, as [Securing Your Environment](securing-your-environment.md#certificates-and-secrets) sets out.
- The email address of the person who will first sign in as Administrator.
- The release to install, such as `v0.1.0`, from [Fathom's releases](https://github.com/ribbitworks/fathom/releases).

## Steps

The host holds only the release's two settings files, never Fathom's source, so it can't build an image: it runs only the release's published images.

1. Make a folder for Fathom, and one in it for the secrets, that only this account can open, such as `/srv/fathom` and `/srv/fathom/secrets`. Making a folder under `/srv` needs `sudo`, so give it to this account as it is made:

   ```sh
   sudo install -d -m 700 -o "$USER" /srv/fathom /srv/fathom/secrets
   ```

1. Go into the folder, and run every later step there:

   ```sh
   cd /srv/fathom
   ```

1. Download the release's Compose file, and its settings as `.env`, naming the release:

   ```sh
   release=v0.1.0
   curl --fail --location --output compose.yaml "https://raw.githubusercontent.com/ribbitworks/fathom/$release/deploy/compose.yaml"
   curl --fail --location --output .env "https://raw.githubusercontent.com/ribbitworks/fathom/$release/deploy/compose.env.example"
   ```

1. Fill the secrets folder with a random password for each of the database's three accounts and a session secret:

   ```sh
   for name in postgres_superuser_password fathom_migrator_password fathom_app_password fathom_auth_secret; do
     openssl rand -hex 32 >"/srv/fathom/secrets/$name"
   done
   ```

1. Copy the certificate and its private key into the secrets folder, as `fathom_tls_cert.pem` and `fathom_tls_key.pem`.
1. Make every file in the secrets folder readable by all, as the containers read them as their own users; the folders keep them private:

   ```sh
   chmod 644 /srv/fathom/secrets/*
   ```

1. Set each setting in `.env`, as its comments describe:
   - `FATHOM_BIND_ADDRESS` and `FATHOM_HTTPS_PORT`: the address and port users reach.
   - `FATHOM_PUBLIC_URL`: the address users type, matching the certificate.
   - `FATHOM_SECRETS_DIR`, `FATHOM_TLS_CERT` and `FATHOM_TLS_KEY`: the folder and files above.
   - `FATHOM_REGISTRY` and `FATHOM_IMAGE_TAG`: where the release's images are published, `ghcr.io/ribbitworks`, and the release downloaded above, without its `v`, such as `0.1.0`.
1. Pull the release's images:

   ```sh
   docker compose pull
   ```

   If it says access is denied, check `FATHOM_IMAGE_TAG` has no `v`, and that the release is published. Never build the images on the host instead.

1. Start Fathom, building nothing, and wait until it's ready:

   ```sh
   docker compose up --detach --no-build --wait
   ```

1. Check that it's running with `docker compose ps`: `proxy`, `app` and `postgres` are listed as up and healthy, and only `proxy` publishes a port on the host, on `FATHOM_BIND_ADDRESS` and `FATHOM_HTTPS_PORT`.
1. Create the first Administrator, named Fathom Administrator, with the email address of the person who will sign in:

   ```sh
   docker compose run --rm --no-deps app apps/server/src/create-administrator.ts --email <address>
   ```

   It prints the account's password once. Running it again changes nothing once an account holds the Administrator role.

1. Give that password to the person whose address it is, to sign in at `FATHOM_PUBLIC_URL`. Fathom asks them for a new password before anything else.

## Verification

- The address in `FATHOM_PUBLIC_URL` opens the **Sign in** page, with no warning about the certificate.
- The Administrator signs in, changes the password, and Fathom opens on the **Overview**, listing the Administrator's jobs.

## Stopping and Updating

- **Stopping:** `docker compose down` stops Fathom and keeps its data in the `fathom_postgres-data` volume. `docker compose up --detach --no-build --wait` starts it again.
- **Updating:** download the new release's `compose.yaml` as above, and its settings to a new file, such as `compose.env.example`, to compare with `.env` for any new setting. Set `FATHOM_IMAGE_TAG` in `.env` to the same release, then pull and start as above; migrations run before the application starts.
- **After installing:** secure the host, the network, backups and accounts as [Securing Your Environment](securing-your-environment.md) sets out, starting with giving the Administrator role to a named person.
