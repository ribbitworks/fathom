---
title: "Manual Test: Accounts"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/accounts-page.tsx", "apps/web/src/accounts-table.tsx", "apps/web/src/accounts-panel.tsx", "apps/web/src/accounts.ts", "apps/web/src/turned-off.tsx", "apps/web/src/change-password.tsx", "apps/web/src/guessable.ts", "apps/web/src/password-settings.tsx", "apps/web/src/history*.ts*", "apps/web/src/layout.tsx", "apps/web/src/session.ts", "apps/web/src/names.ts", "apps/server/src/create-account.ts", "apps/server/src/create-administrator.ts", "apps/server/src/data/accounts.ts", "apps/server/src/data/settings.ts", "apps/server/src/routes/accounts.ts", "apps/server/src/routes/auth.ts", "packages/shared/src/passwords.ts", "packages/shared/src/guessable-passwords.ts", "packages/seed/src/accounts.ts"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/administration.md"]
last_updated: "2026-11-27"
---

# Manual Test: Accounts

## Scope

Verifies what only a person can judge on the Accounts page and the screens around it:

- Creating an account and the one-time password Fathom generates for it, with its eye button and Copy button.
- The journey from the administrator's browser to the new person's first sign-in, and the forced change of the generated password with its checklist.
- An account's side panel, editing, deactivating and reactivating an account, and the greyed-out control that keeps one account able to manage accounts.
- Switching role from the account menu with the pages following at once, and the role chosen last coming back at sign-in.
- The password settings, and the checklist that follows them.

The server's refusals, validation messages, permissions, the generated passwords' recipe, and every wording of the access history are proved by automated tests.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as "Fathom Administrator"
- **Superuser:** `superuser@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`, holding the Feature Lead role, its default, and the Engineering Manager role

This test creates:

- **New Team Member:** `test.newcomer@fathom.test`, shown in Fathom as `Test Newcomer`. ACCT-03 creates it with the Team Member role, as [Roles](../product/roles.md#starting-roles) sets out, and its password is the one ACCT-03 shows, until ACCT-04 changes it. ACCT-06 renames it `Test Arrival`.

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the account menu, the Role menu and the side panel. This test adds:

- **Account's side panel:** the side panel that opens from the details button of an account's row, headed with the account's name. Its **Details** section lists **Name**, **Email address**, **Roles**, **Status** and **Created**. Under it are the buttons **Edit…**, **Reset password…** and **Deactivate…**, or **Reactivate…** in its place for a deactivated account.
- **Role list:** the **Roles** tick boxes in the **New account** and **Edit** dialogs, one square box for each role, with its description under its name.
- **Default role:** the round buttons under the role list, one for each role ticked, shown only while more than one is ticked.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### ACCT-01: Only Those Who May Manage Accounts See the Accounts Page

Covered by [ROLE-01](roles-manual-test.md#role-01-only-those-who-may-see-roles-see-the-roles-page).

### ACCT-02: The Accounts Page Lists Every Account

**Account:** Administrator, `fathom.administrator@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] `096E` Select the **Accounts** page in the left-hand menu.
  - **Expected:** The **Accounts** page opens, with a table of accounts.
  - **Notes:**

- [ ] `328E` Read the column headings, and the top right of the page.
  - **Expected:**
    - The columns are **Name**, **Email address**, **Roles**, **Status** and **Created**
    - **New account** is at the top right
  - **Notes:**

- [ ] `1D11` Read the rows from top to bottom.
  - **Expected:**
    - There are 11 rows, in alphabetical order by name
    - Each **Email address** cell shows the account's email address
    - Each **Roles** cell shows the account's roles, as [Development Setup](../design/development-setup.md#development-accounts) lists: one for every account but "Feature Lead" and "Superuser"
    - The "Feature Lead" row's **Roles** cell reads "Feature Lead (default), Engineering Manager"
    - The "Superuser" row's **Roles** cell reads "Superuser (default)", then every other role
    - Each **Status** cell reads "Active"
    - Each **Created** cell shows a date
  - **Notes:**

- [ ] `1CB3` Look at the "Fathom Administrator" row.
  - **Expected:**
    - The name is followed by a grey "This account" box
    - The role is **Administrator**
    - No other row says "This account"
  - **Notes:**

### ACCT-03: A New Account Gets a Password Fathom Makes

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-02.

**Preconditions:** **Accounts** page open, signed in with this account in the first browser.

- [ ] `8EC9` Select **New account**.
  - **Expected:**
    - A dialog titled "New account" opens, with an empty **Name**, an empty **Email address**, and **Roles**
    - There is no password field
    - **Roles** lists every role, each with a square tick box and its description under its name
    - Only **Team Member** is ticked, and there is no **Default role**
    - Under the role list, a dimmed line says "Custom roles are created on the Roles page.", with **Roles** as a link
  - **Notes:**

- [ ] `4CFD` Type `Test Newcomer` in **Name**.
  - **Expected:** **Name** reads `Test Newcomer`.
  - **Notes:**

- [ ] `6C0E` Type `test.newcomer@fathom.test` in **Email address**.
  - **Expected:** **Email address** reads `test.newcomer@fathom.test`.
  - **Notes:**

- [ ] `283D` Select **Create account**.
  - **Expected:**
    - The dialog is now titled "Password for Test Newcomer"
    - It says "This password is shown only once. Test Newcomer must change it at the next sign-in."
    - Below that, the password is hidden as dots, on a grey ground with no border, so it does not look like a field to type in
    - An eye button is at the password's right, and a **Copy** button beside it
    - **Done** is the only other button
  - **Notes:**

- [ ] `8A6E` Select **Copy**.
  - **Expected:** The button reads "Copied" for a moment.
  - **Notes:**

- [ ] `CEAD` Paste into a text field outside Fathom, such as the browser's address bar, without pressing Enter.
  - **Expected:** The text pasted is letters and digits, not dots.
  - **Notes:**

- [ ] `05B5` Select the eye button.
  - **Expected:**
    - The password shows in grey, in a typeface whose characters are all one width
    - It is the text pasted in step `CEAD`
  - **Notes:**

- [ ] `71EE` Write the password down for ACCT-04, and select **Done**.
  - **Expected:**
    - The dialog closes
    - A notification says "Created the account for Test Newcomer."
    - `Test Newcomer` is in the table with **Team Member** in its **Roles** column
  - **Notes:**

### ACCT-04: A Generated Password Must Be Changed First

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-03. Step `2C28` signs in as another account, in the second browser.

**Preconditions:** ACCT-03 run, with the password it showed written down. The first browser stays signed in with this account.

- [ ] `2C28` In the second browser, open Fathom's address and sign in as the new Team Member, `test.newcomer@fathom.test`, with the password written down.
  - **Expected:**
    - The page shows only Fathom's name and mark above a panel headed **Change password**
    - The panel says "Fathom generated this password. A new password is required to continue."
    - It has **Current password**, **New password**, **New password again**, **Sign out**, and **Change password**
    - Under **New password**, a checklist shows "12 to 128 characters" and "Not a common or easily guessed password", each with a dimmed circle
    - There is no left-hand menu and no account button
  - **Notes:**

- [ ] `5B34` Click in **New password**, and type `test1234`.
  - **Expected:** Both lines of the checklist keep a dimmed circle, and neither is red.
  - **Notes:**

- [ ] `AB9D` Click in **Current password**.
  - **Expected:** Both lines of the checklist turn red, each with a red cross.
  - **Notes:**

- [ ] `B942` Click at the end of **New password**, and type `5678`, so it reads `test12345678`.
  - **Expected:**
    - "12 to 128 characters" shows a green check as soon as the twelfth character is typed
    - "Not a common or easily guessed password" keeps its red cross
  - **Notes:**

- [ ] `B661` Type the password written down in **Current password**.
  - **Expected:** **Current password** shows dots.
  - **Notes:**

- [ ] `EA7B` Replace the text in **New password** with `fictional password 2`.
  - **Expected:** Both lines of the checklist show a green check.
  - **Notes:**

- [ ] `50BE` Type `fictional password 2` in **New password again**.
  - **Expected:** Both lines of the checklist still show a green check.
  - **Notes:**

- [ ] `6AF1` Select **Change password**.
  - **Expected:**
    - A notification says "The password has been changed, and every other session has been signed out."
    - Fathom opens on the **Overview**, with the left-hand menu and the account button
  - **Notes:**

### ACCT-05: A Reset Gives a New Password Fathom Makes

Proved by automated tests in `apps/server/src/accounts-administering.test.ts` and `apps/web/src/accounts-page-editing.test.tsx`.

### ACCT-06: Editing, Deactivating, and Reactivating an Account

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-04.

**Preconditions:** ACCT-04 run. The first browser signed in with this account.

- [ ] `939E` Select the **Accounts** page in the left-hand menu.
  - **Expected:** The **Accounts** page opens.
  - **Notes:**

- [ ] `D3DE` Select the details button at the right of the **Name** cell of `Test Newcomer`.
  - **Expected:**
    - The account's side panel opens, headed "Test Newcomer"
    - Under **Details**, **Name** reads `Test Newcomer`
    - **Email address** reads `test.newcomer@fathom.test`
    - **Roles** reads "Team Member"
    - **Status** reads "Active"
    - **Created** shows today's date, in Fathom's time zone
    - Under them are **Edit…**, **Reset password…** and **Deactivate…**
    - **Deactivate…** is outlined in red
  - **Notes:**

- [ ] `B955` Select **Edit…** in the side panel.
  - **Expected:**
    - A dialog titled "Edit Test Newcomer" opens
    - It shows the account's name, email address, and roles, with only **Team Member** ticked
    - At its foot, the only buttons are **Cancel** and **Save**, with no **Reset password** or **Deactivate**
  - **Notes:**

- [ ] `7C32` Replace the text in **Name** with `Test Arrival`.
  - **Expected:** **Name** reads `Test Arrival`.
  - **Notes:**

- [ ] `971F` Select **Save**.
  - **Expected:**
    - The dialog closes
    - A notification says "Saved the account for Test Arrival."
    - The table has a `Test Arrival` row, with `test.newcomer@fathom.test` under **Email address** and "Team Member" under **Roles**
    - There is no `Test Newcomer` row
    - The side panel is now headed "Test Arrival"
  - **Notes:**

- [ ] `45E7` Select **Deactivate…** in the side panel.
  - **Expected:**
    - A dialog titled "Deactivate Test Arrival" opens
    - It says "Test Arrival will be signed out everywhere, and will not be able to sign in until the account is reactivated."
    - Its buttons are **Cancel** and a red **Deactivate**
  - **Notes:**

- [ ] `19B4` Select **Deactivate**.
  - **Expected:**
    - The dialog closes
    - A notification says "Deactivated the account for Test Arrival."
    - The **Status** cell of the `Test Arrival` row reads "Deactivated"
    - In the side panel, **Status** reads "Deactivated"
    - The side panel's last button reads **Reactivate…**, with no red outline
  - **Notes:**

- [ ] `E8F7` Select **Reactivate…** in the side panel.
  - **Expected:**
    - A dialog titled "Reactivate Test Arrival" opens
    - It says "Test Arrival will be able to sign in again."
  - **Notes:**

- [ ] `2E69` Select **Reactivate** in the dialog.
  - **Expected:**
    - A notification says "Reactivated the account for Test Arrival."
    - The **Status** cell of the `Test Arrival` row reads "Active"
    - Every other **Status** cell reads "Active" too
  - **Notes:**

### ACCT-07: Fathom Keeps One Account That Can Manage Accounts

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-06.

**Preconditions:** ACCT-06 run. The first browser signed in with this account, with the **Accounts** page open.

- [ ] `DE07` Select the details button at the right of the **Name** cell of "Superuser".
  - **Expected:** The account's side panel opens, headed "Superuser".
  - **Notes:**

- [ ] `B485` Select **Deactivate…** in the side panel.
  - **Expected:** A dialog titled "Deactivate Superuser" opens.
  - **Notes:**

- [ ] `A070` Select **Deactivate** in the dialog.
  - **Expected:** A notification says "Deactivated the account for Superuser."
  - **Notes:**

- [ ] `916F` Select the details button at the right of the **Name** cell of "Fathom Administrator".
  - **Expected:**
    - The account's side panel opens, headed "Fathom Administrator", followed by a grey "This account" box
    - Under the **Details** section, the buttons are **Edit…** and **Deactivate…**, with no **Reset password…**
    - **Deactivate…** is greyed out
    - Under **Deactivate…**, a dimmed line reads "No other account can manage accounts."
  - **Notes:**

- [ ] `1A99` Select **Edit…** in the side panel.
  - **Expected:**
    - A dialog titled "Edit Fathom Administrator" opens
    - In the role list, **Administrator** is ticked and greyed out
    - Under **Administrator**, in place of its description, a dimmed line reads "No other account can manage accounts."
    - Every other role can be ticked, with no such line under it
  - **Notes:**

- [ ] `DD84` Tick **Superuser** in the role list.
  - **Expected:**
    - **Administrator** is no longer greyed out, and its description shows under it again
    - Under the role list, **Default role** shows **Administrator** and **Superuser**, with **Administrator** chosen
  - **Notes:**

### ACCT-08: Setting the Password Rules and Recipe

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-07.

**Preconditions:** ACCT-07 run, with its "Edit Fathom Administrator" dialog still open and unsaved. The first browser signed in with this account.

- [ ] `5029` Select **Cancel**.
  - **Expected:** The dialog closes, and nothing is saved.
  - **Notes:**

- [ ] `2CB8` Select the **Application settings** page in the left-hand menu.
  - **Expected:**
    - Under **Time zone**, a second panel has two parts, **Password requirements** and **Generated passwords**
    - **Password requirements** shows **Minimum length** at "12"
    - Its **Must have** shows **An uppercase letter**, **A lowercase letter**, **A digit**, and **A symbol**, none ticked
    - Then the dimmed line "Changes apply the next time each person changes their password."
    - **Generated passwords** shows **Length** at "20"
    - Its **Use** shows **Uppercase letters**, **Lowercase letters**, and **Digits** ticked, and **Symbols:** `! # $ % & * + - = ? @ ^ _ ~` not ticked
    - **Leave out characters that look alike:** `I L O i l o 0 1` is ticked
    - The panel's **Save** is turned off
  - **Notes:**

- [ ] `7DFB` Tick **A symbol**.
  - **Expected:**
    - A red box says "Generated passwords must include symbols, because passwords must contain a symbol."
    - **Save** stays off
  - **Notes:**

- [ ] `B99D` Tick **Symbols**.
  - **Expected:**
    - The red box is gone
    - **Save** is turned on
  - **Notes:**

- [ ] `F205` Select the panel's **Save**.
  - **Expected:**
    - A notification says "Saved the password settings."
    - **Save** is turned off again
  - **Notes:**

- [ ] `DF22` Open the account menu, and select **Change password…**.
  - **Expected:**
    - A dialog titled "Change password" opens
    - Under **New password**, before anything is typed, a checklist shows "12 to 128 characters", "A symbol", and "Not a common or easily guessed password", each with a dimmed circle
  - **Notes:**

- [ ] `BAE4` Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

### ACCT-09: Each Browser Keeps Its Own Appearance

Covered by the [Dark Mode](dark-mode-manual-test.md) manual test.

### ACCT-10: Giving an Account Several Roles and a Default

Covered by [ACCT-02](#acct-02-the-accounts-page-lists-every-account) and [ACCT-07](#acct-07-fathom-keeps-one-account-that-can-manage-accounts).

### ACCT-11: Switching Role From the Account Menu

**Account:** Feature Lead, `feature.lead@fathom.test`, in the second browser, changed from ACCT-08.

**Preconditions:** In the second browser, reload the page, and sign in with this account on the **Sign in** page.

- [ ] `98D6` Open the account menu.
  - **Expected:**
    - Under `feature.lead@fathom.test`, **Role** lists **Engineering Manager** and **Feature Lead**, with a tick beside **Feature Lead** only
    - Then **Change name…**, **Change password…**, **Appearance**, and **Sign out**
  - **Notes:**

- [ ] `498C` Press Esc.
  - **Expected:** The account menu closes.
  - **Notes:**

- [ ] `141F` Select the **Releases** page in the left-hand menu, then the **Schedules** tab.
  - **Expected:**
    - The **Schedules** tab is chosen
    - There is no **New schedule** button at the top right
  - **Notes:**

- [ ] `FD20` Choose **Engineering Manager** in the role menu.
  - **Expected:**
    - The menu closes
    - The page stays on the **Schedules** tab of **Releases**, without the browser reloading
    - **New schedule** shows at the top right
  - **Notes:**

### ACCT-12: Signing In Again Comes Back to the Last Role

**Account:** Feature Lead, `feature.lead@fathom.test`, in the second browser, the same as ACCT-11. Step `BE44` uses the Administrator, `fathom.administrator@fathom.test`, still signed in in the first browser.

**Preconditions:** ACCT-11 run, with **Engineering Manager** chosen in the role menu in the second browser.

- [ ] `5774` Sign out, and sign in with this account again.
  - **Expected:** Fathom opens, with the left-hand menu.
  - **Notes:**

- [ ] `547F` Open the account menu.
  - **Expected:** The tick is beside **Engineering Manager** only.
  - **Notes:**

- [ ] `BE44` In the first browser, open the account menu.
  - **Expected:**
    - Under `fathom.administrator@fathom.test`, the menu shows **Administrator**, with no **Role** heading and nothing to choose
    - Then **Change name…**
  - **Notes:**

### ACCT-13: The Access History Records a Switch of Role

Proved by automated tests in `apps/server/src/accounts-roles.test.ts`.

### ACCT-14: Creating the Fathom Administrator at Install

Covered by [INSTALL-02](acceptance/acceptance-installing-fathom-manual-test.md#install-02-the-first-administrator-is-created) and [INSTALL-03](acceptance/acceptance-installing-fathom-manual-test.md#install-03-the-administrator-signs-in-for-the-first-time).

### ACCT-15: Put Every Account Back

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-12.

**Preconditions:** All the test cases above run.

- [ ] `D7B7` Run Reset the Database, signing in again as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** Fathom opens.
  - **Notes:**

- [ ] `C7E3` Select the **Accounts** page in the left-hand menu.
  - **Expected:**
    - The table lists 11 accounts, with no `Test Arrival`
    - Every **Status** cell reads "Active"
  - **Notes:**
