---
title: "Manual Test: Accounts"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/accounts-page.tsx", "apps/web/src/accounts-table.tsx", "apps/web/src/accounts-panel.tsx", "apps/web/src/accounts.ts", "apps/web/src/change-password.tsx", "apps/web/src/guessable.ts", "apps/web/src/password-settings.tsx", "apps/web/src/history*.ts*", "apps/web/src/layout.tsx", "apps/web/src/session.ts", "apps/web/src/names.ts", "apps/server/src/create-account.ts", "apps/server/src/create-administrator.ts", "apps/server/src/data/accounts.ts", "apps/server/src/data/settings.ts", "apps/server/src/routes/accounts.ts", "apps/server/src/routes/auth.ts", "packages/shared/src/passwords.ts", "packages/shared/src/guessable-passwords.ts", "packages/seed/src/accounts.ts"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-15"
---

# Manual Test: Accounts

## Scope

Verifies what only a person can judge on the Accounts page and the screens around it: who sees the Accounts page, creating an account and the one-time password Fathom generates for it, with its eye button and Copy button; the journey from the administrator's browser to the new person's first sign-in, the forced change of the generated password with its checklist, and a reset; an account's side panel, editing, deactivating, and reactivating an account, finding accounts by status, and the greyed-out control that keeps one account with Edit Administration; giving an account several roles and a default, switching role from the account menu with the pages following at once, the role chosen last coming back at sign-in, and the role a change was made as in the change history and on the Drafts page; the password settings and a generated password that follows them; and the command that creates the Fathom Administrator account at install. The server's refusals, validation messages, permissions, and every wording of the access history are proven by automated tests.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as "Fathom Administrator"
- **Superuser:** `superuser@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Feature Lead:** `feature.lead@fathom.test`, holding the Feature Lead role, its default, and the Engineering Manager role
- **Team Member:** `team.member@fathom.test`

This test creates:

- **New Team Member:** `test.newcomer@fathom.test`, shown in Fathom as `Test Newcomer`. ACCT-03 creates it with the Team Member role, as [Roles](../product/roles.md#starting-roles) sets out, and its password is the one ACCT-03 shows, until ACCT-04 changes it and ACCT-05 resets it. ACCT-06 renames it `Test Arrival`, `test.arrival@fathom.test`, with the Product Manager role.
- **Second new Team Member:** `test.rules@fathom.test`, shown in Fathom as `Test Rules`. ACCT-08 creates it with the Team Member role, and its password is the one ACCT-08 shows.
- **Installed Administrator:** `install.admin@fathom.test`, shown in Fathom as "Fathom Administrator". ACCT-14 creates it with the Administrator role, in an empty database, and its password is the one the command in ACCT-14 prints.

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database). It adds:

### Start With No Accounts

Use only where a test case asks for it. Like Reset the Database, it deletes every account and record in the development database, and asks the maintainer first on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset
   ```

3. Confirm that it finishes with no error.

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the account menu and the Role menu. This test adds:

- **Search box:** the box above the table with a magnifying glass at its left and the hint **Search**, and, once something is typed in it, a **×** at its right end.
- **Status filter:** the choices that open from **Filter…** in the **Status** column menu, with a tick box for each status, such as **Active** and **Deactivated**. While a filter is in use, a box in the bar above the table, after the **Views** button, names it, such as **Status: Deactivated**, with a **×** at its right that removes it.
- **Account's side panel:** the side panel that opens from the details button of an account's row, headed with the account's name. Its **Details** section lists **Name**, **Email address**, **Roles**, **Status** and **Created**. Under it are the buttons **Edit…**, **Reset password…** and **Deactivate…**, or **Reactivate…** in its place for a deactivated account.
- **Role list:** the **Roles** tick boxes in the **New account** and **Edit** dialogs, one square box for each role, with its description under its name.
- **Default role:** the round buttons under the role list, one for each role ticked, shown only while more than one is ticked.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### ACCT-01: Only Those Who May Manage Accounts See the Accounts Page

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step `E144` signs in as another account.

**Preconditions:** Signed in with this account.

- [ ] `1B9E` Look at the left-hand menu.
  - **Expected:** The **Administration** section shows only **Lists** and **Data classes**, with no **Accounts** page.
  - **Notes:**

- [ ] `E144` Sign out, and sign in as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** The left-hand menu shows **Accounts**, **Roles** and **Settings**.
  - **Notes:**

### ACCT-02: The Accounts Page Lists Every Account

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account ACCT-01 ended with.

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
    - There are 12 rows, in alphabetical order by name
    - Each **Email address** cell shows the account's email address
    - Each **Roles** cell shows the account's roles, as [Development Setup](../design/development-setup.md#development-accounts) lists: one for every account but "Feature Lead"
    - The "Feature Lead" row's **Roles** cell reads "Feature Lead (default), Engineering Manager"
    - Each **Status** cell reads "Active"
    - Each **Created** cell shows a date
  - **Notes:**

- [ ] `1CB3` Look at the "Fathom Administrator" row.
  - **Expected:**
    - The name is followed by a grey "This account" box
    - The role is **Administrator**
    - No other row says "This account"
  - **Notes:**

- [ ] `944E` Type `director` in the search box.
  - **Expected:**
    - Only the "Engineering Director" row shows
    - A **×** appears at the right end of the search box
  - **Notes:**

- [ ] `02A2` Select the **×** in the search box.
  - **Expected:**
    - The search box is empty
    - Every account shows again
    - The **×** is gone
  - **Notes:**

- [ ] `2BB5` Type `executive`.
  - **Expected:**
    - The letters go straight into the search box
    - Only the "Executive" row shows
  - **Notes:**

- [ ] `9BE4` Press Esc.
  - **Expected:**
    - The search box empties
    - Every account shows again
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

- [ ] `F2CD` Select **Roles** in the line under the role list.
  - **Expected:**
    - The dialog closes
    - The **Roles** page opens
  - **Notes:**

- [ ] `CB83` Select the **Accounts** page in the left-hand menu.
  - **Expected:** The **Accounts** page opens.
  - **Notes:**

- [ ] `871B` Select **New account**.
  - **Expected:** A dialog titled "New account" opens.
  - **Notes:**

- [ ] `4CFD` Type `Test Newcomer` in **Name**.
  - **Expected:** **Name** reads `Test Newcomer`.
  - **Notes:**

- [ ] `64C8` Type `team.member@fathom.test` in **Email address**.
  - **Expected:** **Email address** reads `team.member@fathom.test`.
  - **Notes:**

- [ ] `2F27` Select **Create account**.
  - **Expected:**
    - A red box in the dialog says "An account with this email address already exists"
    - The dialog stays open
  - **Notes:**

- [ ] `6C0E` Replace the email address with `test.newcomer@fathom.test`.
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

- [ ] `FD69` Click in the password.
  - **Expected:** The whole password is selected.
  - **Notes:**

- [ ] `1BBF` Type a letter.
  - **Expected:** The password does not change.
  - **Notes:**

- [ ] `02EF` Click the page outside the dialog.
  - **Expected:** The dialog stays open, showing the same password.
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

- [ ] `F0FA` Type `test12345678` in **New password again**.
  - **Expected:** **New password again** shows dots.
  - **Notes:**

- [ ] `B8D4` Select **Change password**.
  - **Expected:**
    - **New password** says "This password is too common or easy to guess."
    - Nothing is saved, and the panel stays open
  - **Notes:**

- [ ] `EA7B` Replace the text in **New password** with `fictional password 2`.
  - **Expected:** Both lines of the checklist show a green check.
  - **Notes:**

- [ ] `50BE` Replace the text in **New password again** with `fictional password 2`.
  - **Expected:** Both lines of the checklist still show a green check.
  - **Notes:**

- [ ] `6AF1` Select **Change password**.
  - **Expected:**
    - A notification says "The password has been changed, and every other session has been signed out."
    - Fathom opens on the **Overview**, with the left-hand menu and the account button
  - **Notes:**

### ACCT-05: A Reset Gives a New Password Fathom Makes

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, and the new Team Member, `test.newcomer@fathom.test`, in the second, the same as the accounts ACCT-04 ended with. Step `97A6` signs in again as the new Team Member, in the second browser.

**Preconditions:** ACCT-04 run. Each browser signed in with its account.

- [ ] `939E` In the first browser, select the **Accounts** page in the left-hand menu.
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

- [ ] `FB2A` Select **Reset password…** in the side panel.
  - **Expected:**
    - A dialog titled "Reset the password for Test Newcomer" opens
    - It says "Test Newcomer will be signed out of every session. Fathom will generate a new password, which Test Newcomer must change at the next sign-in."
    - There is no password field
  - **Notes:**

- [ ] `2F99` Select **Reset password**.
  - **Expected:**
    - The dialog is now titled "Password for Test Newcomer"
    - It shows a new password hidden as dots, with the eye button, **Copy** and **Done**
  - **Notes:**

- [ ] `AEBD` Write the password down, and select **Done**.
  - **Expected:** A notification says "Reset the password for Test Newcomer."
  - **Notes:**

- [ ] `C1BB` In the second browser, select any page in the left-hand menu.
  - **Expected:** The **Sign in** page opens.
  - **Notes:**

- [ ] `97A6` Sign in as the new Team Member, `test.newcomer@fathom.test`, with the password written down in step `AEBD`.
  - **Expected:** The panel headed **Change password** opens, saying "Fathom generated this password. A new password is required to continue."
  - **Notes:**

### ACCT-06: Editing, Deactivating, and Reactivating an Account

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-05.

**Preconditions:** ACCT-05 run. The first browser signed in with this account, with the **Accounts** page open and the side panel of `Test Newcomer` still open.

- [ ] `B955` Select **Edit…** in the side panel.
  - **Expected:**
    - A dialog titled "Edit Test Newcomer" opens
    - It shows the account's name, email address, and roles, with only **Team Member** ticked
    - At its foot, the only buttons are **Cancel** and **Save**, with no **Reset password** or **Deactivate**
  - **Notes:**

- [ ] `7C32` Replace the text in **Name** with `Test Arrival`.
  - **Expected:** **Name** reads `Test Arrival`.
  - **Notes:**

- [ ] `E033` Replace the text in **Email address** with `test.arrival@fathom.test`.
  - **Expected:** **Email address** reads `test.arrival@fathom.test`.
  - **Notes:**

- [ ] `1962` Tick **Product Manager**.
  - **Expected:**
    - **Product Manager** and **Team Member** are ticked
    - **Default role** shows under the role list
  - **Notes:**

- [ ] `1E5B` Untick **Team Member**.
  - **Expected:**
    - Only **Product Manager** is ticked
    - **Default role** is gone
  - **Notes:**

- [ ] `971F` Select **Save**.
  - **Expected:**
    - The dialog closes
    - A notification says "Saved the account for Test Arrival."
    - The table has a `Test Arrival` row, with `test.arrival@fathom.test` under **Email address** and "Product Manager" under **Roles**
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

- [ ] `A777` Open the **Status** column menu, and select **Filter…**.
  - **Expected:** The Status filter opens, with **Active** and **Deactivated** among its choices, none ticked.
  - **Notes:**

- [ ] `D9FE` Tick **Deactivated**.
  - **Expected:** Only the `Test Arrival` row shows.
  - **Notes:**

- [ ] `B78D` Press Esc.
  - **Expected:**
    - The Status filter closes
    - In the bar above the table, after the **Views** button, a box reads **Status: Deactivated**
  - **Notes:**

- [ ] `437E` Select the **×** in the **Status: Deactivated** box.
  - **Expected:**
    - The box is gone
    - Every account shows again, 13 in all
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

- [ ] `AD5B` Select the **Access history** page in the left-hand menu.
  - **Expected:**
    - The latest entry says "Fathom Administrator" (`fathom.administrator@fathom.test`) "reactivated the account for" `Test Arrival` (`test.arrival@fathom.test`)
    - The entry before it says "deactivated the account for" `Test Arrival` (`test.arrival@fathom.test`), ending in a grey **Worth checking** box
  - **Notes:**

### ACCT-07: Fathom Keeps One Account That Can Manage Accounts

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-06.

**Preconditions:** ACCT-06 run. The first browser signed in with this account. The Administrator and Superuser roles both manage accounts and edit roles.

- [ ] `8B80` Select the **Accounts** page in the left-hand menu.
  - **Expected:** The **Accounts** page opens.
  - **Notes:**

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
  - **Notes:**

- [ ] `1A99` Select **Edit…** in the side panel.
  - **Expected:**
    - A dialog titled "Edit Fathom Administrator" opens
    - In the role list, **Administrator** is ticked and greyed out
    - Every other role can be ticked
  - **Notes:**

- [ ] `DD84` Tick **Superuser** in the role list.
  - **Expected:**
    - **Administrator** is no longer greyed out
    - Under the role list, **Default role** shows **Administrator** and **Superuser**, with **Administrator** chosen
  - **Notes:**

### ACCT-08: Setting the Password Rules and Recipe

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-07. Step `D967` signs in as another account, in the second browser.

**Preconditions:** ACCT-07 run, with its "Edit Fathom Administrator" dialog still open and unsaved. The first browser signed in with this account.

- [ ] `5029` Select **Cancel**.
  - **Expected:** The dialog closes, and nothing is saved.
  - **Notes:**

- [ ] `2CB8` Select the **Settings** page in the left-hand menu.
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

- [ ] `0175` Replace the text in **Minimum length** with `14`.
  - **Expected:** **Minimum length** reads `14`.
  - **Notes:**

- [ ] `B694` Replace the text in **Length** with `16`.
  - **Expected:** **Length** reads `16`.
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

- [ ] `B06F` Select the **Accounts** page in the left-hand menu.
  - **Expected:** The **Accounts** page opens.
  - **Notes:**

- [ ] `6B4D` Select **New account**.
  - **Expected:** A dialog titled "New account" opens.
  - **Notes:**

- [ ] `ED13` Type `Test Rules` in **Name**.
  - **Expected:** **Name** reads `Test Rules`.
  - **Notes:**

- [ ] `41C9` Type `test.rules@fathom.test` in **Email address**.
  - **Expected:** **Email address** reads `test.rules@fathom.test`.
  - **Notes:**

- [ ] `6235` Select **Create account**.
  - **Expected:** The dialog is now titled "Password for Test Rules".
  - **Notes:**

- [ ] `8E8F` Select the eye button.
  - **Expected:** The password has 16 characters, and includes at least one of `! # $ % & * + - = ? @ ^ _ ~`.
  - **Notes:**

- [ ] `A836` Write the password down, and select **Done**.
  - **Expected:** A notification says "Created the account for Test Rules."
  - **Notes:**

- [ ] `D967` In the second browser, sign in as the second new Team Member, `test.rules@fathom.test`, with the password written down.
  - **Expected:**
    - The panel headed **Change password** opens
    - Under **New password**, before anything is typed, a checklist shows "14 to 128 characters", "A symbol", and "Not a common or easily guessed password", each with a dimmed circle
  - **Notes:**

### ACCT-09: Each Browser Keeps Its Own Appearance

Covered by the [Dark Mode](dark-mode-manual-test.md) manual test.

### ACCT-10: Giving an Account Several Roles and a Default

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-08.

**Preconditions:** Signed in with this account in the first browser, with the **Accounts** page open.

- [ ] `7393` Select the details button at the right of the **Name** cell of "Team Member".
  - **Expected:** The account's side panel opens, headed "Team Member".
  - **Notes:**

- [ ] `26F2` Select **Edit…** in the side panel.
  - **Expected:**
    - A dialog titled "Edit Team Member" opens
    - In the role list, only **Team Member** is ticked
    - There is no **Default role**
  - **Notes:**

- [ ] `BF47` Tick **Executive**.
  - **Expected:** Under the role list, **Default role** shows **Executive** and **Team Member**, in the order of the role list, with **Team Member** chosen.
  - **Notes:**

- [ ] `50D9` Choose **Executive** under **Default role**.
  - **Expected:** **Executive** is chosen.
  - **Notes:**

- [ ] `6EB1` Select **Save**.
  - **Expected:**
    - A notification says "Saved the account for Team Member."
    - The **Roles** cell of the "Team Member" row reads "Executive (default), Team Member"
  - **Notes:**

- [ ] `4B2F` Select **Edit…** in the side panel.
  - **Expected:** **Executive** and **Team Member** are ticked.
  - **Notes:**

- [ ] `4D05` Untick **Executive**.
  - **Expected:**
    - **Default role** disappears
    - Only **Team Member** is ticked
  - **Notes:**

- [ ] `3E3B` Select **Save**.
  - **Expected:**
    - A notification says "Saved the account for Team Member."
    - The **Roles** cell of the "Team Member" row reads only "Team Member"
  - **Notes:**

### ACCT-11: Switching Role From the Account Menu

**Account:** Feature Lead, `feature.lead@fathom.test`, in the second browser, changed from ACCT-10.

**Preconditions:** In the second browser, select **Sign out** on the **Change password** panel ACCT-08 left open, and sign in with this account.

- [ ] `98D6` Open the account menu.
  - **Expected:**
    - Under `feature.lead@fathom.test`, **Role** lists **Engineering Manager** and **Feature Lead**, with a tick beside **Feature Lead** only
    - Then **Change name**, **Change password**, **Appearance**, and **Sign out**
  - **Notes:**

- [ ] `498C` Press Esc.
  - **Expected:** The account menu closes.
  - **Notes:**

- [ ] `141F` Select the **Releases** page in the left-hand menu.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] `DAAD` Select the details button at the right of the **Schedule** cell of 'Platform'.
  - **Expected:** In the panel beside the table, under **Releases**:
    - The 'Harbor 1' row has no **⋯** button
    - There is no **New release…** button
  - **Notes:**

- [ ] `FD20` Choose **Engineering Manager** in the role menu.
  - **Expected:**
    - The menu closes
    - The page stays on **Releases** with 'Platform' open, without the browser reloading
    - Under **Releases**, the 'Harbor 1' row now ends with a **⋯** button
    - **New release…** shows
  - **Notes:**

- [ ] `5B6D` Open the account menu.
  - **Expected:** The tick is beside **Engineering Manager** only.
  - **Notes:**

- [ ] `AF71` Press Esc.
  - **Expected:** The account menu closes.
  - **Notes:**

- [ ] `C1E3` Select the **⋯** button at the end of the 'Harbor 1' row, then **Change…**.
  - **Expected:** A dialog titled "Change Harbor 1" opens.
  - **Notes:**

- [ ] `06AB` Replace the name with `Harbor One`.
  - **Expected:** The name reads `Harbor One`.
  - **Notes:**

- [ ] `234F` Select **Save**.
  - **Expected:**
    - A notification says "Drafted the change to the release."
    - The row reads `Harbor One`, with a hollow yellow dot before its square
  - **Notes:**

- [ ] `B3D9` Select the Publish button in the top bar.
  - **Expected:**
    - A notification says "Published" followed by the number of changes
    - The button is gone
  - **Notes:**

- [ ] `B92F` Select the **Change history** page in the left-hand menu.
  - **Expected:** The latest entry:
    - Names `Harbor One`
    - Starts with "Feature Lead as Engineering Manager"
  - **Notes:**

- [ ] `EB91` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The entry for `Harbor One` starts with "Feature Lead as Engineering Manager".
  - **Notes:**

- [ ] `D396` Choose **Feature Lead** in the role menu.
  - **Expected:**
    - The page stays on **Drafts**
    - The entry for `Harbor One` still starts with "Feature Lead as Engineering Manager"
  - **Notes:**

### ACCT-12: Signing In Again Comes Back to the Last Role

**Account:** Feature Lead, `feature.lead@fathom.test`, in the second browser, the same as ACCT-11. Step `0320` signs in with it in the first browser, and step `4E41` signs in as another account there.

**Preconditions:** ACCT-11 run, with **Feature Lead** chosen in the role menu in the second browser.

- [ ] `6B16` Choose **Engineering Manager** in the role menu.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `5774` Sign out, and sign in with this account again.
  - **Expected:** Fathom opens, with the left-hand menu.
  - **Notes:**

- [ ] `547F` Open the account menu.
  - **Expected:** The tick is beside **Engineering Manager** only.
  - **Notes:**

- [ ] `0320` In the first browser, sign out, and sign in as the Feature Lead, `feature.lead@fathom.test`.
  - **Expected:** Fathom opens, with the left-hand menu.
  - **Notes:**

- [ ] `94D8` Open the account menu.
  - **Expected:** The tick is beside **Feature Lead** only.
  - **Notes:**

- [ ] `4E41` In the first browser, sign out, and sign in as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** Fathom opens, with the left-hand menu.
  - **Notes:**

- [ ] `BE44` Open the account menu.
  - **Expected:**
    - Under `fathom.administrator@fathom.test`, the menu shows **Administrator**, with no **Role** heading and nothing to choose
    - Then **Change name**
  - **Notes:**

### ACCT-13: The Access History Records a Switch of Role

Proven by automated tests, as the scope sets out; ACCT-06 checks an access history entry on screen.

### ACCT-14: Creating the Fathom Administrator at Install

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-12. Step `08E9` deletes it, and step `6DB1` signs in as another account.

**Preconditions:** None. This test case empties the database, so ACCT-15 must follow it.

- [ ] `08E9` Run Start With No Accounts.
  - **Expected:** It finishes with no error.
  - **Notes:**

- [ ] `EF8E` In the second terminal, run:

   ```sh
   pnpm admin:create --email install.admin@fathom.test
   ```

  - **Expected:**
    - It prints `Created the Fathom Administrator account for install.admin@fathom.test.`
    - Then `Password:` followed by 20 letters and digits
    - Then `Fathom shows this password only once, and asks for a new one at first sign-in.`
  - **Notes:**

- [ ] `648A` Write the password down, and run Start Fathom.
  - **Expected:** The browser shows the **Sign in** page.
  - **Notes:**

- [ ] `6DB1` In the first browser, sign in as the installed Administrator, `install.admin@fathom.test`, with the password written down.
  - **Expected:** The panel headed **Change password** opens, saying "Fathom generated this password. A new password is required to continue."
  - **Notes:**

### ACCT-15: Put Every Account Back

**Account:** Installed Administrator, `install.admin@fathom.test`, the same as the account ACCT-14 ended with. Step `D7B7` signs in as another account.

**Preconditions:** All the test cases above run.

- [ ] `D7B7` Run Reset the Database, signing in again as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** Fathom opens.
  - **Notes:**

- [ ] `C7E3` Select the **Accounts** page in the left-hand menu.
  - **Expected:**
    - The table lists 12 accounts, with no `Test Arrival` or `Test Rules`
    - `fathom.administrator@fathom.test` is the "Fathom Administrator"
    - Every **Status** cell reads "Active"
  - **Notes:**
