---
title: "Manual Test: Accounts"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/accounts-page.tsx", "apps/web/src/accounts.ts", "apps/web/src/change-password.tsx", "apps/web/src/guessable.ts", "apps/web/src/password-settings.tsx", "apps/web/src/history*.ts*", "apps/server/src/create-account.ts", "apps/server/src/create-administrator.ts", "apps/server/src/data/accounts.ts", "apps/server/src/data/settings.ts", "apps/server/src/routes/accounts.ts", "apps/server/src/routes/auth.ts", "packages/shared/src/passwords.ts", "packages/shared/src/guessable-passwords.ts"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-06"
---

# Manual Test: Accounts

## Scope

Verifies what only a person can judge on the Accounts page and the screens around it: who sees the Accounts page, how it looks in light and dark mode, creating an account and the one-time password Fathom generates for it, with its eye button and Copy button; the journey from the administrator's browser to the new person's first sign-in, the forced change of the generated password with its checklist, and a reset; editing, deactivating, and reactivating an account, and the greyed-out control that keeps one account able to manage accounts and edit roles; the password settings and a generated password that follows them; and the command that creates the Fathom Administrator account at install. The server's refusals, validation messages, permissions, and every wording of the access history are proven by automated tests.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R2 and R3).
- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

R2 creates these accounts, with every other development account, each holding one role, as [Development Setup](../design/development-setup.md#development-accounts) lists. They share one password, which R2 prints when it finishes. Every role is as Fathom starts it.

- **Administrator account:** `fathom.administrator@fathom.test`, shown in Fathom as **Fathom Administrator**. It holds the Administrator role, so it can manage accounts, edit roles, and see the access history.
- **Superuser account:** `superuser@fathom.test`, shown in Fathom as **Superuser**. It holds the Superuser role, which grants every permission.
- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, and cannot manage accounts.
- **Team Member account:** `team.member@fathom.test`, shown in Fathom as **Team Member**. It holds the Team Member role.

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

### P1: Sign In

1. If someone is signed in, sign out first (P2).
2. On the **Sign in** page, enter the account's email address and the shared password.
3. Select **Sign in**.

### P2: Sign Out

1. Select the account button at the top right, which shows the account's name.
2. Select **Sign out**.

## Terms

- **Search box:** the box above the table with a magnifying glass at its left and the hint **Search**.
- **Filter:** the three buttons beside the search box: **All**, **Active** and **Deactivated**, each followed by a count.
- **Role list:** the **Role** choices in the **New account** and **Edit** dialogs, one round button for each role, with its description under its name.

## Test Cases

Run the test cases in order. Start with R2. Check each step whose expected result you see, and write anything else under its notes.

### ACCT-01: Only Those Who May Manage Accounts See the Accounts Page

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`.

- [ ] **Step 1.** Look at the left-hand menu.
  - **Expected:** There is no **Administration** section and no **Accounts** page.
  - **Notes:**

- [ ] **Step 2.** Sign out (P2), and sign in (P1) as `fathom.administrator@fathom.test`.
  - **Expected:** The left-hand menu shows **Accounts**, **Roles** and **Settings** under **Administration**.
  - **Notes:**

### ACCT-02: The Accounts Page Lists Every Account

**Preconditions:** Signed in (P1) as `fathom.administrator@fathom.test`.

- [ ] **Step 1.** Select **Accounts** under **Administration** in the left-hand menu, and read the column headings.
  - **Expected:** The table has the columns **Person**, **Role**, **Status** and **Created**. **New account** is at the top right.
  - **Notes:**

- [ ] **Step 2.** Read the rows from top to bottom.
  - **Expected:** There are 12 rows, in alphabetical order by name. Each **Person** cell shows the person's initials, name, and email address, and each **Role** cell shows one role, as [Development Setup](../design/development-setup.md#development-accounts) lists. Each **Status** cell says **Active**, in green. Each **Created** cell shows a date. Each row ends with an **Edit** button.
  - **Notes:**

- [ ] **Step 3.** Look at the **Fathom Administrator** row.
  - **Expected:** The name is followed by **You**, and the role is **Administrator**. No other row says **You**.
  - **Notes:**

- [ ] **Step 4.** Read the buttons of the filter.
  - **Expected:** **All 12**, **Active 12** and **Deactivated 0**, with **All 12** selected.
  - **Notes:**

- [ ] **Step 5.** Type `director` in the search box.
  - **Expected:** Only the **Engineering Director** row shows.
  - **Notes:**

- [ ] **Step 6.** Clear the search box. Change the computer's appearance setting to dark, and look at the page.
  - **Expected:** The page has a dark ground and every word is easy to read. The **You** badge is lighter than it was in light mode, and **Active** is green.
  - **Notes:**

- [ ] **Step 7.** Change the computer's appearance setting back to light.
  - **Expected:** The page returns to its light colours.
  - **Notes:**

### ACCT-03: A New Account Gets a Password Fathom Makes

**Preconditions:** **Accounts** page open, signed in (P1) as `fathom.administrator@fathom.test` in the first browser.

- [ ] **Step 1.** Select **New account**.
  - **Expected:** A dialog titled **New account**, with an empty **Name**, an empty **Email address**, and **Role**, and no password field. **Role** lists every role in the order of the **Roles** page, each with a round button and its description under its name. Only **Team Member** is chosen. Under the role list, a dimmed line says **Custom roles are created on the Roles page.**, with **Roles** as a link.
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
  - **Expected:** The dialog closes, a green banner says **Created the account for Test Newcomer.**, and **Test Newcomer** is in the table with **Team Member** in its **Role** column.
  - **Notes:**

### ACCT-04: A Generated Password Must Be Changed First

**Preconditions:** ACCT-03 run, with the password it showed written down. The first browser stays signed in as `fathom.administrator@fathom.test`.

- [ ] **Step 1.** In the second browser, open Fathom's address and sign in (P1) as `test.newcomer@fathom.test` with the password written down.
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

**Preconditions:** ACCT-04 run. The first browser is signed in as `fathom.administrator@fathom.test`, and the second as `test.newcomer@fathom.test`.

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

- [ ] **Step 5.** Sign in as `test.newcomer@fathom.test` with the password written down in Step 3.
  - **Expected:** The panel headed **Change password** opens, as in ACCT-04.
  - **Notes:**

### ACCT-06: Editing, Deactivating, and Reactivating an Account

**Preconditions:** ACCT-05 run. The first browser is signed in as `fathom.administrator@fathom.test`, with the **Accounts** page open.

- [ ] **Step 1.** Select **Edit** in the **Test Newcomer** row. Type `Test Arrival` in **Name** and `test.arrival@fathom.test` in **Email address**, choose **Planner**, and select **Save**.
  - **Expected:** The dialog, titled **Edit Test Newcomer**, shows the account's name, email address, and role, with **Team Member** chosen and the buttons **Reset password**, **Deactivate**, **Cancel** and **Save**. After **Save** is selected, the dialog closes, a green banner says **Saved the account for Test Arrival.**, and the table has a **Test Arrival** row with `test.arrival@fathom.test` and **Planner**, and no **Test Newcomer** row.
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

- [ ] **Step 5.** Select **Access history** under **History** in the left-hand menu.
  - **Expected:** The latest entry says Fathom Administrator (`fathom.administrator@fathom.test`) **reactivated the account for** Test Arrival (`test.arrival@fathom.test`). The one before says **deactivated the account for** Test Arrival (`test.arrival@fathom.test`), and is marked as worth checking.
  - **Notes:**

### ACCT-07: Fathom Keeps One Account That Can Manage Accounts

**Preconditions:** ACCT-06 run. The first browser is signed in as `fathom.administrator@fathom.test`. The Administrator and Superuser roles both manage accounts and edit roles.

- [ ] **Step 1.** Select **Accounts**, then **Edit** in the **Superuser** row, then **Deactivate**, then **Deactivate** in the dialog.
  - **Expected:** A green banner says **Deactivated the account for Superuser.**
  - **Notes:**

- [ ] **Step 2.** Select **Edit** in the **Fathom Administrator** row.
  - **Expected:** **Deactivate** is greyed out. In the role list, **Administrator** is chosen, **Superuser** can be chosen, and **Team Member** is greyed out, like every role that cannot both manage accounts and edit roles.
  - **Notes:**

### ACCT-08: Setting the Password Rules and Recipe

**Preconditions:** ACCT-07 run, with its **Edit Fathom Administrator** dialog still open. The first browser is signed in as `fathom.administrator@fathom.test`.

- [ ] **Step 1.** Select **Cancel**, then **Settings** under **Administration** in the left-hand menu.
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

- [ ] **Step 6.** Write the password down, and select **Done**. In the second browser, sign in (P1) as `test.rules@fathom.test` with it.
  - **Expected:** The panel headed **Change password** opens. Under **New password**, before anything is typed, a checklist shows **14 to 128 characters**, **A symbol**, and **Not a common or easily guessed password**, each with a dimmed circle.
  - **Notes:**

### ACCT-09: Creating the Fathom Administrator at Install

**Preconditions:** None. This test case empties the database, so ACCT-10 must follow it.

- [ ] **Step 1.** Start with no accounts (R3). In the second terminal, run:

   ```sh
   pnpm admin:create --email install.admin@fathom.test
   ```

  - **Expected:** It prints `Created the Fathom Administrator account for install.admin@fathom.test.`, then `Password:` followed by 20 letters and digits, then `Fathom shows this password only once, and asks for a new one at first sign-in.`
  - **Notes:**

- [ ] **Step 2.** Write the password down. Start Fathom (R0), and in the first browser sign in (P1) as `install.admin@fathom.test` with it.
  - **Expected:** The panel headed **Change password** opens, as in ACCT-04.
  - **Notes:**

### ACCT-10: Put Every Account Back

**Preconditions:** All the test cases above run.

- [ ] **Step 1.** Reset the database (R2), and sign in (P1) as `fathom.administrator@fathom.test`.
  - **Expected:** Fathom opens.
  - **Notes:**

- [ ] **Step 2.** Select **Accounts** under **Administration** in the left-hand menu.
  - **Expected:** The table lists 12 accounts, as in ACCT-02, with no **Test Arrival** or **Test Rules**, and with `fathom.administrator@fathom.test` as the **Fathom Administrator**. The filter reads **All 12**, **Active 12** and **Deactivated 0**.
  - **Notes:**
