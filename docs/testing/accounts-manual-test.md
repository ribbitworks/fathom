---
title: "Manual Test: Accounts"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/accounts-page.tsx", "apps/web/src/accounts.ts", "apps/web/src/change-password.tsx", "apps/web/src/guessable.ts", "apps/web/src/password-settings.tsx", "apps/web/src/history*.ts*", "apps/web/src/layout.tsx", "apps/web/src/session.ts", "apps/web/src/names.ts", "apps/server/src/create-account.ts", "apps/server/src/create-administrator.ts", "apps/server/src/data/accounts.ts", "apps/server/src/data/settings.ts", "apps/server/src/routes/accounts.ts", "apps/server/src/routes/auth.ts", "packages/shared/src/passwords.ts", "packages/shared/src/guessable-passwords.ts", "packages/seed/src/accounts.ts"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-07"
---

# Manual Test: Accounts

## Scope

Verifies what only a person can judge on the Accounts page and the screens around it: who sees the Accounts page, how it looks in light and dark mode, creating an account and the one-time password Fathom generates for it, with its eye button and Copy button; the journey from the administrator's browser to the new person's first sign-in, the forced change of the generated password with its checklist, and a reset; editing, deactivating, and reactivating an account, and the greyed-out control that keeps one account able to manage accounts and edit roles; giving an account several roles and a default, switching role from the account menu with the pages following at once, the role chosen last coming back at sign-in, and the role a change was made as in the change history and on the Drafts page; the password settings and a generated password that follows them; and the command that creates the Fathom Administrator account at install. The server's refusals, validation messages, permissions, and every wording of the access history are proven by automated tests.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser, on a computer whose appearance can be switched between light and dark.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R2 and R3).
- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

R2 creates these accounts, with every other development account, each holding one role except the Feature Lead, which holds two, as [Development Setup](../design/development-setup.md#development-accounts) lists. They share one password, which R2 prints when it finishes. Every role is as Fathom starts it.

- **Administrator account:** `fathom.administrator@fathom.test`, shown in Fathom as **Fathom Administrator**. It holds the Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Superuser account:** `superuser@fathom.test`, shown in Fathom as **Superuser**. It holds the Superuser role, which grants every permission.
- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Feature Lead account:** `feature.lead@fathom.test`, shown in Fathom as **Feature Lead**. It holds the Feature Lead role, its default, and the Engineering Manager role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Team Member account:** `team.member@fathom.test`, shown in Fathom as **Team Member**. It holds the Team Member role, as [Roles](../product/roles.md#starting-roles) sets out.
- **New Team Member account:** `test.newcomer@fathom.test`, shown in Fathom as **Test Newcomer**. ACCT-03 creates it with the Team Member role, as [Roles](../product/roles.md#starting-roles) sets out, and its password is the one ACCT-03 shows, until ACCT-04 changes it and ACCT-05 resets it. ACCT-06 renames it **Test Arrival**, `test.arrival@fathom.test`, with the Product Manager role.
- **Second new Team Member account:** `test.rules@fathom.test`, shown in Fathom as **Test Rules**. ACCT-08 creates it with the Team Member role, and its password is the one ACCT-08 shows.
- **Installed Administrator account:** `install.admin@fathom.test`, shown in Fathom as **Fathom Administrator**. ACCT-14 creates it with the Administrator role, in an empty database, and its password is the one the command in ACCT-14 prints.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at the address the terminal prints, such as `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R2: Reset the Database

Use before the first test case and after the last, so every account is as Fathom starts it. This deletes every account and record in the development database, including anything added by hand; restoring only the seed data does not. Ask the owner before running it on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Start Fathom again (R0).

### R3: Start With No Accounts

Use only where a test case asks for it. Like R2, it deletes every account and record in the development database, and asks the owner first on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset
   ```

3. Confirm that it finishes with no error.

## Terms

- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance**, in the menu that opens from your name and initials at the top right of every page.
- **Search box:** the box above the table with a magnifying glass at its left and the hint **Search**, and, once something is typed in it, a **×** at its right end.
- **Filter:** the three buttons beside the search box: **All**, **Active** and **Deactivated**, each followed by a count.
- **Role list:** the **Roles** tick boxes in the **New account** and **Edit** dialogs, one square box for each role, with its description under its name.
- **Default role:** the round buttons under the role list, one for each role ticked, shown only while more than one is ticked.
- **Role menu:** the choices under **Role**, in the menu that opens from your name and initials at the top right of every page, shown only for an account with more than one role.

## Test Cases

Run the test cases in order. Start with R2. Check each step whose expected result you see, and write anything else under its notes.

### ACCT-01: Only Those Who May Manage Accounts See the Accounts Page

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step 2 signs in as another account.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Look at the left-hand menu.
  - **Expected:** There is no **Administration** section and no **Accounts** page.
  - **Notes:**

- [ ] **Step 2.** Sign out, and sign in as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** The left-hand menu shows **Accounts**, **Roles** and **Settings**.
  - **Notes:**

### ACCT-02: The Accounts Page Lists Every Account

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account ACCT-01 ended with.

**Preconditions:** Signed in with this account. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select **Accounts** in the left-hand menu, and read the column headings.
  - **Expected:** The table has the columns **Person**, **Roles**, **Status** and **Created**. **New account** is at the top right.
  - **Notes:**

- [ ] **Step 2.** Read the rows from top to bottom.
  - **Expected:** There are 12 rows, in alphabetical order by name. Each **Person** cell shows the person's initials, name, and email address, and each **Roles** cell shows the account's roles, as [Development Setup](../design/development-setup.md#development-accounts) lists: one for every account but **Feature Lead**, whose cell shows **Feature Lead (default)** then **Engineering Manager**. Each **Status** cell says **Active**, in green. Each **Created** cell shows a date. Each row ends with an **Edit** button.
  - **Notes:**

- [ ] **Step 3.** Look at the **Fathom Administrator** row.
  - **Expected:** The name is followed by **You**, and the role is **Administrator**. No other row says **You**.
  - **Notes:**

- [ ] **Step 4.** Read the buttons of the filter.
  - **Expected:** **All 12**, **Active 12** and **Deactivated 0**, with **All 12** selected.
  - **Notes:**

- [ ] **Step 5.** Type `director` in the search box.
  - **Expected:** Only the **Engineering Director** row shows, and a **×** appears at the right end of the search box.
  - **Notes:**

- [ ] **Step 6.** Choose **Dark** in the Appearance menu.
  - **Expected:** The page has a dark ground and every word is easy to read. The **×** in the search box is easy to see. The **You** badge is lighter than it was in light mode, and **Active** is green.
  - **Notes:**

- [ ] **Step 7.** Select the **×** in the search box.
  - **Expected:** The search box is empty, every account shows again, and the **×** is gone.
  - **Notes:**

- [ ] **Step 8.** Type `planner`.
  - **Expected:** The letters go straight into the search box, and only the **Resource Planner** row shows.
  - **Notes:**

- [ ] **Step 9.** Press Esc.
  - **Expected:** The search box empties, and every account shows again.
  - **Notes:**

- [ ] **Step 10.** Choose **Light** in the Appearance menu.
  - **Expected:** The page returns to its light colours.
  - **Notes:**

### ACCT-03: A New Account Gets a Password Fathom Makes

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-02.

**Preconditions:** **Accounts** page open, signed in with this account in the first browser.

- [ ] **Step 1.** Select **New account**.
  - **Expected:** A dialog titled **New account**, with an empty **Name**, an empty **Email address**, and **Roles**, and no password field. **Roles** lists every role in the order of the **Roles** page, each with a square tick box and its description under its name. Only **Team Member** is ticked, and there is no **Default role**. Under the role list, a dimmed line says **Custom roles are created on the Roles page.**, with **Roles** as a link.
  - **Notes:**

- [ ] **Step 2.** Select **Roles** in the line under the role list.
  - **Expected:** The dialog closes, and the **Roles** page opens.
  - **Notes:**

- [ ] **Step 3.** Select **Accounts**, then **New account**. Type `Test Newcomer` in **Name** and `team.member@fathom.test` in **Email address**, and select **Create account**.
  - **Expected:** A red box in the dialog says **An account with this email address already exists**, and the dialog stays open.
  - **Notes:**

- [ ] **Step 4.** Replace the email address with `test.newcomer@fathom.test`, and select **Create account**.
  - **Expected:** The dialog, now titled **Password for Test Newcomer**, says **This password is shown only once. Test Newcomer must change it at the next sign-in.** Below it, the password is hidden as dots, on a grey ground with no border, so it does not look like a field to type in, with an eye button at its right, as on the **Sign in** page. Beside it is a **Copy** button, and **Done** is the only other button.
  - **Notes:**

- [ ] **Step 5.** Select **Copy**, then paste into any text field outside Fathom, such as the browser's address bar, without pressing Enter.
  - **Expected:** The button reads **Copied** for a moment, and the text pasted is letters and digits, not dots.
  - **Notes:**

- [ ] **Step 6.** Select the eye button.
  - **Expected:** The password shows in grey, in a typeface whose characters are all one width, and is the text pasted in Step 5.
  - **Notes:**

- [ ] **Step 7.** Click in the password, and try to type.
  - **Expected:** The whole password is selected, and typing does not change it.
  - **Notes:**

- [ ] **Step 8.** Click the page outside the dialog.
  - **Expected:** The dialog stays open, showing the same password.
  - **Notes:**

- [ ] **Step 9.** Write the password down for ACCT-04, and select **Done**.
  - **Expected:** The dialog closes, a green banner says **Created the account for Test Newcomer.**, and **Test Newcomer** is in the table with **Team Member** in its **Roles** column.
  - **Notes:**

### ACCT-04: A Generated Password Must Be Changed First

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-03. Step 1 signs in as another account, in the second browser.

**Preconditions:** ACCT-03 run, with the password it showed written down. The first browser stays signed in with this account.

- [ ] **Step 1.** In the second browser, open Fathom's address and sign in as the new Team Member, `test.newcomer@fathom.test`, with the password written down.
  - **Expected:** The page shows only Fathom's name and mark above a panel headed **Change password**, saying **Fathom generated this password. A new password is required to continue.**, with **Current password**, **New password**, **New password again**, **Sign out**, and **Change password**. Under **New password**, a checklist shows **12 to 128 characters** and **Not a common or easily guessed password**, each with a dimmed circle. There is no left-hand menu and no account button.
  - **Notes:**

- [ ] **Step 2.** Click in **New password**, and type `test1234`.
  - **Expected:** Both lines of the checklist keep a dimmed circle, and neither is red.
  - **Notes:**

- [ ] **Step 3.** Click in **Current password**.
  - **Expected:** Both lines of the checklist turn red, each with a red cross.
  - **Notes:**

- [ ] **Step 4.** Click at the end of **New password**, and type `5678`, so it reads `test12345678`.
  - **Expected:** **12 to 128 characters** shows a green check as soon as the twelfth character is typed. **Not a common or easily guessed password** keeps its red cross.
  - **Notes:**

- [ ] **Step 5.** Enter the password written down in **Current password** and `test12345678` in **New password again**, and select **Change password**.
  - **Expected:** **New password** says **This password is too common or easy to guess.**, and nothing is saved.
  - **Notes:**

- [ ] **Step 6.** Replace both new passwords with `fictional password 2`.
  - **Expected:** Both lines of the checklist show a green check.
  - **Notes:**

- [ ] **Step 7.** Select **Change password**.
  - **Expected:** A green banner says **Your password has been changed, and you have been signed out everywhere else.**, and Fathom opens on the **Overview**, with the left-hand menu and the account button.
  - **Notes:**

### ACCT-05: A Reset Gives a New Password Fathom Makes

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, and the new Team Member, `test.newcomer@fathom.test`, in the second, the same as the accounts ACCT-04 ended with. Step 5 signs in again as the new Team Member, in the second browser.

**Preconditions:** ACCT-04 run. Each browser signed in with its account.

- [ ] **Step 1.** In the first browser, select **Accounts**, then **Edit** in the **Test Newcomer** row, then **Reset password**.
  - **Expected:** A dialog titled **Reset the password for Test Newcomer** says **Test Newcomer will be signed out of every session. Fathom will generate a new password, which Test Newcomer must change at the next sign-in.**, with no password field.
  - **Notes:**

- [ ] **Step 2.** Select **Reset password**.
  - **Expected:** The dialog, now titled **Password for Test Newcomer**, shows a new password hidden as dots, with the eye button, **Copy** and **Done**.
  - **Notes:**

- [ ] **Step 3.** Write the password down, and select **Done**.
  - **Expected:** A green banner says **Reset the password for Test Newcomer.**
  - **Notes:**

- [ ] **Step 4.** In the second browser, select any page in the left-hand menu.
  - **Expected:** The **Sign in** page opens.
  - **Notes:**

- [ ] **Step 5.** Sign in as the new Team Member, `test.newcomer@fathom.test`, with the password written down in Step 3.
  - **Expected:** The panel headed **Change password** opens, as in ACCT-04.
  - **Notes:**

### ACCT-06: Editing, Deactivating, and Reactivating an Account

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-05.

**Preconditions:** ACCT-05 run. The first browser signed in with this account, with the **Accounts** page open.

- [ ] **Step 1.** Select **Edit** in the **Test Newcomer** row. Type `Test Arrival` in **Name** and `test.arrival@fathom.test` in **Email address**, tick **Product Manager**, untick **Team Member**, and select **Save**.
  - **Expected:** The dialog, titled **Edit Test Newcomer**, shows the account's name, email address, and roles, with only **Team Member** ticked and the buttons **Reset password**, **Deactivate**, **Cancel** and **Save**. After **Save** is selected, the dialog closes, a green banner says **Saved the account for Test Arrival.**, and the table has a **Test Arrival** row with `test.arrival@fathom.test` and **Product Manager**, and no **Test Newcomer** row.
  - **Notes:**

- [ ] **Step 2.** Select **Edit** in the **Test Arrival** row, then **Deactivate**.
  - **Expected:** A dialog titled **Deactivate Test Arrival** says **Test Arrival will be signed out everywhere, and will not be able to sign in until the account is reactivated.**, with **Cancel** and a red **Deactivate**.
  - **Notes:**

- [ ] **Step 3.** Select **Deactivate**.
  - **Expected:** The dialog closes, a green banner says **Deactivated the account for Test Arrival.**, and the **Test Arrival** row says **Deactivated**, in grey. The filter reads **All 13**, **Active 12** and **Deactivated 1**.
  - **Notes:**

- [ ] **Step 4.** Select **Deactivated 1** in the filter, then **Edit** in the **Test Arrival** row, then **Reactivate**, then **Reactivate** in the dialog.
  - **Expected:** The edit dialog offers **Reactivate** in place of **Deactivate**. A dialog titled **Reactivate Test Arrival** says **Test Arrival will be able to sign in again.** After the second **Reactivate**, a green banner says **Reactivated the account for Test Arrival.**, and the filter reads **All 13**, **Active 13** and **Deactivated 0**.
  - **Notes:**

- [ ] **Step 5.** Select **Access history** in the left-hand menu.
  - **Expected:** The latest entry says Fathom Administrator (`fathom.administrator@fathom.test`) **reactivated the account for** Test Arrival (`test.arrival@fathom.test`). The one before says **deactivated the account for** Test Arrival (`test.arrival@fathom.test`), and is marked as worth checking.
  - **Notes:**

### ACCT-07: Fathom Keeps One Account That Can Manage Accounts

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-06.

**Preconditions:** ACCT-06 run. The first browser signed in with this account. The Administrator and Superuser roles both manage accounts and edit roles.

- [ ] **Step 1.** Select **Accounts**, then **Edit** in the **Superuser** row, then **Deactivate**, then **Deactivate** in the dialog.
  - **Expected:** A green banner says **Deactivated the account for Superuser.**
  - **Notes:**

- [ ] **Step 2.** Select **Edit** in the **Fathom Administrator** row.
  - **Expected:** **Deactivate** is greyed out. In the role list, **Administrator** is ticked and greyed out, and every other role can be ticked.
  - **Notes:**

- [ ] **Step 3.** Tick **Superuser** in the role list.
  - **Expected:** **Administrator** is no longer greyed out. Under the role list, **Default role** shows **Administrator** and **Superuser**, with **Administrator** chosen.
  - **Notes:**

### ACCT-08: Setting the Password Rules and Recipe

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-07. Step 6 signs in as another account, in the second browser.

**Preconditions:** ACCT-07 run, with its **Edit Fathom Administrator** dialog still open and unsaved. The first browser signed in with this account.

- [ ] **Step 1.** Select **Cancel**, then **Settings** in the left-hand menu.
  - **Expected:** Under **Time zone**, a second panel has two parts. **Password requirements** shows **Minimum length** at 12, and **Must have** with **An uppercase letter**, **A lowercase letter**, **A digit**, and **A symbol**, none ticked, then the dimmed line **Changes apply the next time each person changes their password.** **Generated passwords** shows **Length** at 20, and **Use** with **Uppercase letters**, **Lowercase letters**, and **Digits** ticked and **Symbols:** `! # $ % & * + - = ? @ ^ _ ~` not ticked, then **Leave out characters that look alike:** `I L O i l o 0 1`, ticked. The panel's **Save** is turned off.
  - **Notes:**

- [ ] **Step 2.** Tick **A symbol**.
  - **Expected:** A red box says **Generated passwords must include symbols, because passwords must contain a symbol.**, and **Save** stays off.
  - **Notes:**

- [ ] **Step 3.** Enter `14` in **Minimum length** and `16` in **Length**, and tick **Symbols**.
  - **Expected:** The red box is gone, and **Save** is turned on.
  - **Notes:**

- [ ] **Step 4.** Select the panel's **Save**.
  - **Expected:** A green banner says **Saved the password settings.**, and **Save** is turned off again.
  - **Notes:**

- [ ] **Step 5.** Select **Accounts**, then **New account**. Type `Test Rules` in **Name** and `test.rules@fathom.test` in **Email address**, select **Create account**, and select the eye button.
  - **Expected:** The dialog titled **Password for Test Rules** shows a password of 16 characters that includes at least one of `! # $ % & * + - = ? @ ^ _ ~`.
  - **Notes:**

- [ ] **Step 6.** Write the password down, and select **Done**. In the second browser, sign in as the second new Team Member, `test.rules@fathom.test`, with it.
  - **Expected:** The panel headed **Change password** opens. Under **New password**, before anything is typed, a checklist shows **14 to 128 characters**, **A symbol**, and **Not a common or easily guessed password**, each with a dimmed circle.
  - **Notes:**

### ACCT-09: Each Browser Keeps Its Own Appearance

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-08. Step 8 signs in again with this account.

**Preconditions:** Signed in with this account. The computer's appearance set to light. **Light** chosen in the Appearance menu, as ACCT-02 leaves it. The case ends with **Light** chosen.

- [ ] **Step 1.** Choose **System** in the Appearance menu.
  - **Expected:** The page stays light, as the computer is set.
  - **Notes:**

- [ ] **Step 2.** Open the menu from your name and initials at the top right.
  - **Expected:** Under **Appearance**, **System**, **Light** and **Dark**, with a tick beside **System** only.
  - **Notes:**

- [ ] **Step 3.** Press Escape, then press Tab until the button with your name and initials has focus, and press Enter.
  - **Expected:** The menu opens, and the first item has focus.
  - **Notes:**

- [ ] **Step 4.** Press the down arrow until **Dark** has focus, and press Enter.
  - **Expected:** The menu closes, and the whole page turns dark at once: the sidebar, the table and the top bar.
  - **Notes:**

- [ ] **Step 5.** Reload the page.
  - **Expected:** The page opens dark.
  - **Notes:**

- [ ] **Step 6.** Open the menu from your name and initials.
  - **Expected:** The tick is beside **Dark**.
  - **Notes:**

- [ ] **Step 7.** Press Escape, and sign out.
  - **Expected:** The sign-in page is dark.
  - **Notes:**

- [ ] **Step 8.** Sign in with this account again.
  - **Expected:** The page is dark.
  - **Notes:**

- [ ] **Step 9.** Choose **System** in the Appearance menu.
  - **Expected:** The page turns light, as the computer is set.
  - **Notes:**

- [ ] **Step 10.** Set the computer's appearance to dark.
  - **Expected:** Fathom turns dark with it.
  - **Notes:**

- [ ] **Step 11.** Set the computer's appearance back to light.
  - **Expected:** Fathom turns light again.
  - **Notes:**

- [ ] **Step 12.** Choose **Light** in the Appearance menu.
  - **Expected:** The page stays light, and the tick is beside **Light**.
  - **Notes:**

### ACCT-10: Giving an Account Several Roles and a Default

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-09.

**Preconditions:** Signed in with this account in the first browser, with the **Accounts** page open.

- [ ] **Step 1.** Select **Edit** in the **Team Member** row.
  - **Expected:** In the role list, only **Team Member** is ticked, and there is no **Default role**.
  - **Notes:**

- [ ] **Step 2.** Tick **Executive**.
  - **Expected:** Under the role list, **Default role** shows **Executive** and **Team Member**, in the order of the role list, with **Team Member** chosen.
  - **Notes:**

- [ ] **Step 3.** Choose **Executive** under **Default role**, and select **Save**.
  - **Expected:** A green banner says **Saved the account for Team Member.**, and the **Roles** cell of the **Team Member** row shows **Executive (default)** then **Team Member**.
  - **Notes:**

- [ ] **Step 4.** Select **Edit** in the **Team Member** row, and untick **Executive**.
  - **Expected:** **Default role** disappears, and only **Team Member** is ticked.
  - **Notes:**

- [ ] **Step 5.** Select **Save**.
  - **Expected:** A green banner says **Saved the account for Team Member.**, and the **Roles** cell of the **Team Member** row shows only **Team Member**.
  - **Notes:**

### ACCT-11: Switching Role From the Account Menu

**Account:** Feature Lead, `feature.lead@fathom.test`, in the second browser, changed from ACCT-10.

**Preconditions:** In the second browser, select **Sign out** on the **Change password** panel ACCT-08 left open, and sign in with this account. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Open the menu from your name and initials at the top right.
  - **Expected:** Under `feature.lead@fathom.test`, **Role** lists **Engineering Manager** and **Feature Lead**, with a tick beside **Feature Lead** only, followed by **Change name**, **Change password**, **Appearance**, and **Sign out**.
  - **Notes:**

- [ ] **Step 2.** Press Escape. Select **Releases** in the left-hand menu, then **Platform** in the table.
  - **Expected:** In the panel beside the table, under **Releases**, the rows **Harbor 1**, **Harbor 2**, and **Harbor 3** have no **⋯** button, and there is no **New release…** button.
  - **Notes:**

- [ ] **Step 3.** Choose **Engineering Manager** in the role menu.
  - **Expected:** The menu closes, and the page stays on **Releases** with **Platform** open, without the browser reloading. Under **Releases**, each row now ends with a **⋯** button, and **New release…** shows.
  - **Notes:**

- [ ] **Step 4.** Open the menu from your name and initials, and press Escape.
  - **Expected:** The tick is beside **Engineering Manager** only.
  - **Notes:**

- [ ] **Step 5.** Select the **⋯** button at the end of the **Harbor 3** row, then **Change…**. Replace the name with `Harbor Three`, and select **Save**.
  - **Expected:** A notification says **Drafted the change to the release.** The row reads **Harbor Three**, with a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 6.** Select the **Publish** button in the top bar.
  - **Expected:** A notification says **Published**, and the button is gone.
  - **Notes:**

- [ ] **Step 7.** Select **Change history** in the left-hand menu.
  - **Expected:** The latest entry names **Harbor Three** and starts with **Feature Lead as Engineering Manager**.
  - **Notes:**

- [ ] **Step 8.** Select **Drafts** in the left-hand menu.
  - **Expected:** The entry for **Harbor Three** starts with **Feature Lead as Engineering Manager**.
  - **Notes:**

- [ ] **Step 9.** Choose **Feature Lead** in the role menu.
  - **Expected:** The page stays on **Drafts**, and the entry for **Harbor Three** still starts with **Feature Lead as Engineering Manager**.
  - **Notes:**

- [ ] **Step 10.** Choose **Dark** in the Appearance menu, open the menu from your name and initials, then press Escape and choose **Light** in the Appearance menu.
  - **Expected:** In dark mode, the role menu's ticks and names are easy to read.
  - **Notes:**

### ACCT-12: Signing In Again Comes Back to the Last Role

**Account:** Feature Lead, `feature.lead@fathom.test`, in the second browser, the same as ACCT-11. Step 2 signs in with it in the first browser, and step 3 signs in as another account there.

**Preconditions:** ACCT-11 run, with **Feature Lead** chosen in the role menu in the second browser.

- [ ] **Step 1.** Choose **Engineering Manager** in the role menu. Sign out, sign in with this account again, and open the menu from your name and initials.
  - **Expected:** The tick is beside **Engineering Manager** only.
  - **Notes:**

- [ ] **Step 2.** In the first browser, sign out, sign in as the Feature Lead, `feature.lead@fathom.test`, and open the menu from your name and initials.
  - **Expected:** The tick is beside **Feature Lead** only.
  - **Notes:**

- [ ] **Step 3.** In the first browser, sign out, sign in as the Administrator, `fathom.administrator@fathom.test`, and open the menu from your name and initials.
  - **Expected:** Under `fathom.administrator@fathom.test`, the menu shows **Administrator**, with no **Role** heading and nothing to choose, then **Change name**.
  - **Notes:**

### ACCT-13: The Access History Records a Switch of Role

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-12.

**Preconditions:** ACCT-10 to ACCT-12 run. Signed in with this account in the first browser.

- [ ] **Step 1.** Press Escape. Select **Access history** in the left-hand menu, and type `switched` in the search box at the top of the page.
  - **Expected:** The latest entry says Feature Lead (`feature.lead@fathom.test`) **switched role**, **from Feature Lead to Engineering Manager**, not marked as worth checking.
  - **Notes:**

### ACCT-14: Creating the Fathom Administrator at Install

**Account:** Administrator, `fathom.administrator@fathom.test`, in the first browser, the same as ACCT-13. Step 1 deletes it, and step 2 signs in as another account.

**Preconditions:** None. This test case empties the database, so ACCT-15 must follow it.

- [ ] **Step 1.** Start with no accounts (R3). In the second terminal, run:

   ```sh
   pnpm admin:create --email install.admin@fathom.test
   ```

  - **Expected:** It prints `Created the Fathom Administrator account for install.admin@fathom.test.`, then `Password:` followed by 20 letters and digits, then `Fathom shows this password only once, and asks for a new one at first sign-in.`
  - **Notes:**

- [ ] **Step 2.** Write the password down. Start Fathom (R0), and in the first browser sign in as the installed Administrator, `install.admin@fathom.test`, with it.
  - **Expected:** The panel headed **Change password** opens, as in ACCT-04.
  - **Notes:**

### ACCT-15: Put Every Account Back

**Account:** Installed Administrator, `install.admin@fathom.test`, the same as the account ACCT-14 ended with. Step 1 signs in as another account.

**Preconditions:** All the test cases above run.

- [ ] **Step 1.** Reset the database (R2), and sign in as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** Fathom opens.
  - **Notes:**

- [ ] **Step 2.** Select **Accounts** in the left-hand menu.
  - **Expected:** The table lists 12 accounts, as in ACCT-02, with no **Test Arrival** or **Test Rules**, and with `fathom.administrator@fathom.test` as the **Fathom Administrator**. The filter reads **All 12**, **Active 12** and **Deactivated 0**.
  - **Notes:**
