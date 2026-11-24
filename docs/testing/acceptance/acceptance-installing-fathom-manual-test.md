---
title: "Manual Test: Acceptance, Installing Fathom"
category: "How-To"
audience: "Contributors"
applies_to: ["deploy/**", "apps/server/src/create-administrator.ts", "apps/web/src/change-password.tsx"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/operations/installing-fathom.md", "docs/operations/securing-your-environment.md"]
last_updated: "2026-11-23"
---

# Manual Test: Acceptance, Installing Fathom

## Scope

Verifies that Fathom installs as [Installing Fathom](../../operations/installing-fathom.md) describes, from building and starting it through the first Administrator's first sign-in on an empty database, and that its data stays when it stops and starts. It runs on a development machine standing in for a server, with an mkcert certificate standing in for the organization's, and is the first acceptance test: every other one runs on the installation it makes, starting with [The Team's Accounts](acceptance-team-accounts-manual-test.md).

## Test Environment

This test, like every acceptance test, doesn't use the clone's development Fathom. It needs:

- A desktop web browser, and one terminal open at the repository root.
- The clone set up as [Development Setup § First Run](../../design/development-setup.md#first-run) describes, so a container runtime with Docker Compose, `openssl` and mkcert are installed, and mkcert's certificate authority is trusted.
- No `deploy/.env` file in the clone.
- No earlier installation on the machine: `docker compose ls --all` lists no project named `fathom`, and `docker volume ls` lists no volume named `fathom_postgres-data`. If one is there, run [Start Again](../manual-test-basics.md#start-again) first.
- Port 10443 free on the machine.
- A plain text editor.

## Test Accounts

This test uses no development account. It creates:

- **Administrator:** `install.administrator@fathom.test`, shown in Fathom as "Fathom Administrator". INSTALL-02 creates it, and its password is the one INSTALL-02 prints, until INSTALL-03 changes it to `fictional install password`.

## Common Procedures

Every command runs in the **Terminal**.

### Prepare the Installation

Run before the first test case. This makes the installation's secrets and certificate in `~/fathom-install/secrets`, and its settings in `deploy/.env`, as [Installing Fathom](../../operations/installing-fathom.md#steps) sets out, with a folder in the home folder in place of `/srv/fathom`.

1. Make the secrets folder, then the secrets, the certificate and their permissions:

   ```sh
   mkdir -p ~/fathom-install/secrets
   chmod 700 ~/fathom-install ~/fathom-install/secrets
   for name in postgres_superuser_password fathom_migrator_password fathom_app_password fathom_auth_secret; do
     openssl rand -hex 32 >~/fathom-install/secrets/$name
   done
   mkcert -cert-file ~/fathom-install/secrets/fathom_tls_cert.pem -key-file ~/fathom-install/secrets/fathom_tls_key.pem localhost
   chmod 644 ~/fathom-install/secrets/*
   ```

2. Confirm that `ls ~/fathom-install/secrets` lists six files: `fathom_app_password`, `fathom_auth_secret`, `fathom_migrator_password`, `fathom_tls_cert.pem`, `fathom_tls_key.pem` and `postgres_superuser_password`.
3. Run `cp deploy/compose.env.example deploy/.env`, and run `echo $HOME` to see the home folder's full path.
4. Open `deploy/.env` in the text editor. It holds the example file's values, such as `FATHOM_BIND_ADDRESS=10.0.0.10`, which are to be replaced. Change these six settings to read as follows, writing the path `echo $HOME` printed in place of each `<home>`, and save it:

   ```text
   FATHOM_BIND_ADDRESS=127.0.0.1
   FATHOM_HTTPS_PORT=10443
   FATHOM_PUBLIC_URL=https://localhost:10443
   FATHOM_SECRETS_DIR=<home>/fathom-install/secrets
   FATHOM_TLS_CERT=<home>/fathom-install/secrets/fathom_tls_cert.pem
   FATHOM_TLS_KEY=<home>/fathom-install/secrets/fathom_tls_key.pem
   ```

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **Terminal:** the terminal of the Test Environment, at the repository root.

## Test Cases

Run the test cases in order, in about 30 minutes, plus the time the first build takes. Start with Prepare the Installation. Check each step whose expected result you see, and write anything else under its notes. [The Team's Accounts](acceptance-team-accounts-manual-test.md) follows on from the last test case.

### INSTALL-01: Fathom Is Built and Started

**Account:** None; the first test case.

**Preconditions:** Prepare the Installation run.

- [ ] `974D` In the Terminal, run `docker compose --file deploy/compose.yaml up --detach --build --wait`, and wait for the next prompt.
  - **Expected:**
    - The images build, which takes several minutes the first time, and longer on a processor that isn't x86-64.
    - The last lines name `fathom-postgres-1`, `fathom-migrate-1`, `fathom-app-1` and `fathom-proxy-1`, with no line saying "Error".
  - **Notes:**

- [ ] `EFDC` Run `docker compose --file deploy/compose.yaml ps`.
  - **Expected:**
    - Three containers are listed: `fathom-app-1`, `fathom-postgres-1` and `fathom-proxy-1`.
    - Each **STATUS** starts "Up" and ends "(healthy)".
    - The **PORTS** of `fathom-proxy-1` reads `127.0.0.1:10443->8443/tcp`.
  - **Notes:**

### INSTALL-02: The First Administrator Is Created

**Account:** None, the same as INSTALL-01.

**Preconditions:** INSTALL-01 done.

- [ ] `B76F` Run `docker compose --file deploy/compose.yaml run --rm --no-deps app apps/server/src/create-administrator.ts --email install.administrator@fathom.test`.
  - **Expected:**
    - A line says "Created the Fathom Administrator account for" followed by `install.administrator@fathom.test`.
    - A line starting "Password: " gives the password. Write it down.
    - The last line says "Fathom shows this password only once, and asks for a new one at first sign-in."
  - **Notes:**

### INSTALL-03: The Administrator Signs In for the First Time

**Account:** Administrator, `install.administrator@fathom.test`, changed from INSTALL-02.

**Preconditions:** INSTALL-02 done. A new browser window open.

- [ ] `A6B4` Open the web address `https://localhost:10443`.
  - **Expected:**
    - A page shows Fathom's name, the **Email address** and **Password** fields, and a **Sign in** button.
    - The browser shows no warning about the certificate.
  - **Notes:**

- [ ] `413C` Type `install.administrator@fathom.test` in **Email address**.
  - **Expected:** **Email address** shows what was typed.
  - **Notes:**

- [ ] `B973` Type the password INSTALL-02 printed in **Password**, and select **Sign in**.
  - **Expected:**
    - A page headed **Change password** shows.
    - It says "Fathom generated this password. A new password is required to continue."
    - It offers **Sign out** and **Change password**, with no left-hand menu.
  - **Notes:**

- [ ] `9C83` Type the password INSTALL-02 printed in **Current password**.
  - **Expected:** **Current password** shows a dot for each character typed.
  - **Notes:**

- [ ] `BC2B` Type `fictional install password` in **New password**.
  - **Expected:** **New password** shows a dot for each character typed.
  - **Notes:**

- [ ] `1553` Type `fictional install password` in **New password again**.
  - **Expected:** **New password again** shows a dot for each character typed.
  - **Notes:**

- [ ] `E7BC` Select **Change password**.
  - **Expected:**
    - A notification says "The password has been changed, and every other session has been signed out."
    - Fathom opens on the **Accounts** page, with the left-hand menu.
    - The table lists one account, "Fathom Administrator", with the email address `install.administrator@fathom.test` and **Status** "Active".
  - **Notes:**

### INSTALL-04: The Data Stays When Fathom Stops and Starts

**Account:** Administrator, `install.administrator@fathom.test`, the same as INSTALL-03.

**Preconditions:** INSTALL-03 done. **Accounts** page open.

- [ ] `DF5F` In the Terminal, run `docker compose --file deploy/compose.yaml down`.
  - **Expected:** Each of the four containers is listed as removed, with no line saying "Error".
  - **Notes:**

- [ ] `F87A` Run `docker compose --file deploy/compose.yaml up --detach --wait`, and wait for the next prompt.
  - **Expected:** The last lines name the four containers, with no line saying "Error", and nothing is built.
  - **Notes:**

- [ ] `5F51` Reload the browser page.
  - **Expected:**
    - The **Accounts** page shows, still signed in, with no **Sign in** page.
    - The table lists "Fathom Administrator", as before.
  - **Notes:**

**Afterwards:** Run [The Team's Accounts](acceptance-team-accounts-manual-test.md) next, on this installation, staying signed in. To stop here instead, run [Start Again](../manual-test-basics.md#start-again).
