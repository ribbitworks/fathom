---
title: "Manual Test: Administrator Workflows"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-an-administrator.md", "docs/product/roles.md"]
last_updated: "2026-11-23"
---

# Manual Test: Administrator Workflows

## Scope

Verifies the workflows of [Working as an Administrator](../help/working-as-an-administrator.md) on the seed data: making an account that signs in for the first time, giving it a copied role, changing what a role grants after checking who gains what, restoring a starting role, deactivating, reactivating and resetting the account, setting the rules for passwords, and checking the access history.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A browser window at least 1,440 pixels wide.
- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as "Fathom Administrator"

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **New account:** `fictional.newcomer@fathom.test`, shown in Fathom as `Fictional Newcomer`, which ADMIN-01 creates with the Team Member role. Its password is the one ADMIN-01 shows, until ADMIN-01 changes it to `fictional password 2`. ADMIN-02 gives it the `Fictional Reader` role in place of Team Member.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### ADMIN-01: A New Account Signs In for the First Time

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser; the first test case. The second browser signs in as the new account in step `BC14`.

**Preconditions:** Reset the Database run. Signed in with this account in the main browser.

- [ ] `6BF5` Look at the left-hand menu.
  - **Expected:**
    - The **Administration** section shows **Accounts**, **Roles** and **Settings**.
    - The **History** section shows **Access history**.
    - The menu shows the **Help** section.
    - It shows no page of the plan or of people.
  - **Notes:**

- [ ] `A38F` Select the **Accounts** page in the left-hand menu.
  - **Expected:** The **Accounts** page opens.
  - **Notes:**

- [ ] `FD38` Select **New account**.
  - **Expected:**
    - A dialog titled "New account" opens.
    - **Name** and **Email address** are empty.
    - **Roles** lists every role, each with a square tick box and its description.
    - Only **Team Member** is ticked.
  - **Notes:**

- [ ] `2DE6` Type `Fictional Newcomer` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `E7AF` Type `fictional.newcomer@fathom.test` in **Email address**.
  - **Expected:** **Email address** shows what was typed.
  - **Notes:**

- [ ] `DF8E` Select **Create account**.
  - **Expected:** The dialog, titled "Password for Fictional Newcomer", says "This password is shown only once. Fictional Newcomer must change it at the next sign-in."
  - **Notes:**

- [ ] `A55E` Select the eye button, and write the password down.
  - **Expected:** The eye button shows the password.
  - **Notes:**

- [ ] `0C1C` Select **Done**.
  - **Expected:**
    - A green banner says "Created the account for Fictional Newcomer."
    - The table has a `Fictional Newcomer` row with **Team Member** in **Roles**.
  - **Notes:**

- [ ] `BC14` In the second browser, sign out if signed in, and sign in as the new account, `fictional.newcomer@fathom.test`, with the password written down.
  - **Expected:**
    - A panel headed **Change password** says "Fathom generated this password. A new password is required to continue."
    - There is no left-hand menu.
  - **Notes:**

- [ ] `8E0E` Enter the password written down in **Current password**.
  - **Expected:** **Current password** is filled in.
  - **Notes:**

- [ ] `FCE5` Enter `fictional password 2` in **New password**.
  - **Expected:** **New password** is filled in.
  - **Notes:**

- [ ] `9C94` Enter `fictional password 2` in **New password again**.
  - **Expected:** **New password again** is filled in.
  - **Notes:**

- [ ] `160A` Select **Change password**.
  - **Expected:**
    - A green banner says "The password has been changed, and every other session has been signed out."
    - Fathom opens on the **Overview**.
    - The left-hand menu is shown.
  - **Notes:**

### ADMIN-02: A Copied Role Is Given to the New Account

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ADMIN-01. The second browser stays signed in as the new account.

**Preconditions:** ADMIN-01 done. **Roles** page open from the left-hand menu.

- [ ] `AFE7` Select **Copy** in the **Team Member** row.
  - **Expected:**
    - A dialog titled "Copy Team Member" opens.
    - The name reads "Copy of Team Member".
    - **View** is ticked on **Plan**, **Features and releases**, **Allocations**, **People** and **Feature teams**.
    - Its main button is **Create role**.
  - **Notes:**

- [ ] `F492` Replace the name with `Fictional Reader`.
  - **Expected:** The name reads `Fictional Reader`.
  - **Notes:**

- [ ] `420A` Tick **View** on **Configuration**.
  - **Expected:** **View** on **Configuration** is ticked.
  - **Notes:**

- [ ] `FB50` Select **Create role**.
  - **Expected:**
    - A green banner says "The role has been created."
    - `Fictional Reader` is in the list with 0 accounts.
  - **Notes:**

- [ ] `066A` Select **Accounts** in the left-hand menu.
  - **Expected:** The **Accounts** page opens, with a `Fictional Newcomer` row.
  - **Notes:**

- [ ] `910A` Select the details button at the right of the **Name** cell of `Fictional Newcomer`.
  - **Expected:**
    - A side panel opens, headed "Fictional Newcomer".
    - Its **Details** section lists **Name**, **Email address**, **Roles**, **Status** and **Created**.
    - Under them are **Edit…**, **Reset password…** and **Deactivate…**.
  - **Notes:**

- [ ] `A74D` Select **Edit…** in the side panel.
  - **Expected:** A dialog titled "Edit Fictional Newcomer" opens, with only **Team Member** ticked.
  - **Notes:**

- [ ] `D862` Tick `Fictional Reader`.
  - **Expected:** `Fictional Reader` is ticked.
  - **Notes:**

- [ ] `3C07` Untick **Team Member**.
  - **Expected:** **Team Member** is not ticked.
  - **Notes:**

- [ ] `DC03` Select **Save**.
  - **Expected:**
    - A green banner says "Saved the account for Fictional Newcomer."
    - The row's **Roles** cell shows `Fictional Reader`.
  - **Notes:**

- [ ] `5D1B` In the second browser, reload the page.
  - **Expected:** The left-hand menu shows **Lists** in the **Administration** section.
  - **Notes:**

### ADMIN-03: A Role Is Changed After Checking Who Gains What

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ADMIN-02.

**Preconditions:** ADMIN-02 done. **Roles** page open from the left-hand menu.

- [ ] `8BF7` Select **Edit** in the `Fictional Reader` row.
  - **Expected:** The role dialog opens, titled **Edit Fictional Reader**.
  - **Notes:**

- [ ] `DAB8` Tick **View** on the **Administration** row.
  - **Expected:** **View** on **Administration** is ticked.
  - **Notes:**

- [ ] `2C52` Select **Save**.
  - **Expected:**
    - The dialog says "This change affects 1 account."
    - It lists `Fictional Newcomer`, with its email address.
    - Under **Gains**: a line for each of the **Accounts**, **Roles**, **Settings** and **Access history** pages.
    - **Cancel** and **Save changes** are on the right.
  - **Notes:**

- [ ] `C212` Select **Save changes**.
  - **Expected:** A notification says "The role has been changed."
  - **Notes:**

- [ ] `96A1` In the second browser, reload the page.
  - **Expected:** The left-hand menu shows the **Administration** section.
  - **Notes:**

### ADMIN-04: Restore Template Brings Back a Starting Role

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ADMIN-03.

**Preconditions:** **Roles** page open.

- [ ] `CFBF` Select **Edit** in the **Executive** row.
  - **Expected:** The role dialog opens.
  - **Notes:**

- [ ] `F434` Tick **Edit** on the **Plan** row.
  - **Expected:**
    - **Description** reads "Sees the plan, people, with their Personal and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them."
    - **Restore template** is turned on.
  - **Notes:**

- [ ] `F0D2` Select **Restore template**.
  - **Expected:**
    - **Edit** on **Plan** is unticked.
    - **Restore template** is turned off.
  - **Notes:**

- [ ] `9EBB` Select **Cancel**.
  - **Expected:**
    - The dialog closes.
    - The **Executive** row's description reads "Sees the plan, people, with their Personal and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them."
  - **Notes:**

### ADMIN-05: A Deactivated Account Is Signed Out, Then Reactivated

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ADMIN-04. The second browser stays signed in as the new account.

**Preconditions:** ADMIN-02 done. **Accounts** page open.

- [ ] `3F66` Select the details button at the right of the **Name** cell of `Fictional Newcomer`.
  - **Expected:** A side panel opens, headed "Fictional Newcomer".
  - **Notes:**

- [ ] `CC99` Select **Deactivate…** in the side panel.
  - **Expected:**
    - A dialog titled "Deactivate Fictional Newcomer" says "Fictional Newcomer will be signed out everywhere, and will not be able to sign in until the account is reactivated."
    - It offers **Cancel** and a red **Deactivate**.
  - **Notes:**

- [ ] `E2DE` Select **Deactivate**.
  - **Expected:**
    - A green banner says "Deactivated the account for Fictional Newcomer."
    - The row's **Status** cell reads "Deactivated".
    - The side panel offers **Reactivate…** in place of **Deactivate…**.
  - **Notes:**

- [ ] `F8D7` In the second browser, select any page in the left-hand menu.
  - **Expected:** The **Sign in** page opens.
  - **Notes:**

- [ ] `A325` In the main browser, open the **Status** column menu, and select **Filter…**.
  - **Expected:** **Active** and **Deactivated** are among the choices.
  - **Notes:**

- [ ] `BB20` Tick **Deactivated**.
  - **Expected:** Only the `Fictional Newcomer` row is listed.
  - **Notes:**

- [ ] `AC16` Press Esc.
  - **Expected:**
    - The choices close.
    - In the bar above the table, after the **Views** button, a box reads **Status: Deactivated**.
  - **Notes:**

- [ ] `FACA` Select **Reactivate…** in the side panel.
  - **Expected:** A dialog opens with a **Reactivate** button.
  - **Notes:**

- [ ] `D3CC` Select **Reactivate** in the dialog.
  - **Expected:**
    - A green banner says "Reactivated the account for Fictional Newcomer."
    - The table shows "No matching accounts".
    - The side panel still shows "Fictional Newcomer", with **Status** reading "Active" and **Deactivate…** in place of **Reactivate…**.
  - **Notes:**

- [ ] `DB1D` In the second browser, sign in as the new account, `fictional.newcomer@fathom.test`, with `fictional password 2`.
  - **Expected:**
    - Fathom opens.
    - **Change history** is in the left-hand menu.
  - **Notes:**

### ADMIN-06: The New Account's Password Is Reset

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ADMIN-05.

**Preconditions:** **Accounts** page open, with the **Status: Deactivated** filter and the side panel of `Fictional Newcomer` that ADMIN-05 left open.

- [ ] `61CF` Select the **×** in the **Status: Deactivated** box above the table.
  - **Expected:** Every account is listed, `Fictional Newcomer` among them.
  - **Notes:**

- [ ] `9F93` Select **Reset password…** in the side panel.
  - **Expected:**
    - A dialog titled "Reset the password for Fictional Newcomer" opens.
    - It says "Fictional Newcomer will be signed out of every session. Fathom will generate a new password, which Fictional Newcomer must change at the next sign-in."
  - **Notes:**

- [ ] `7A20` Select **Reset password** in the dialog.
  - **Expected:** The dialog is titled "Password for Fictional Newcomer", with the eye button, **Copy** and **Done**.
  - **Notes:**

- [ ] `6B45` Select **Done**.
  - **Expected:** A notification says "Reset the password for Fictional Newcomer."
  - **Notes:**

- [ ] `738A` In the second browser, select any page in the left-hand menu.
  - **Expected:** The **Sign in** page opens.
  - **Notes:**

### ADMIN-07: The Rules for Passwords Are Changed

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ADMIN-06.

**Preconditions:** None beyond ADMIN-06.

- [ ] `773F` Select the **Settings** page in the left-hand menu.
  - **Expected:**
    - **Password requirements** shows **Minimum length** at "12".
    - The panel's **Save** is turned off.
  - **Notes:**

- [ ] `1BC2` Replace the text in **Minimum length** with `14`.
  - **Expected:** The panel's **Save** is turned on.
  - **Notes:**

- [ ] `20C7` Select the panel's **Save**.
  - **Expected:**
    - A notification says "Saved the password settings."
    - **Save** is turned off again.
  - **Notes:**

### ADMIN-08: The Access History Records What Was Done to the Account

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ADMIN-07.

**Preconditions:** ADMIN-01 to ADMIN-06 done.

- [ ] `0A88` Select the **Access history** page in the left-hand menu.
  - **Expected:** The **Access history** page opens.
  - **Notes:**

- [ ] `4E6C` Type `Fictional Newcomer` in the search box at the top of the page.
  - **Expected:** The entries include, from newest to oldest:
    - "Fathom Administrator" "reset the password for" `Fictional Newcomer`, marked as worth checking
    - "Fathom Administrator" "reactivated the account for" `Fictional Newcomer`
    - "Fathom Administrator" "deactivated the account for" `Fictional Newcomer`, marked as worth checking
    - "Fathom Administrator" "changed the role of" `Fictional Newcomer`, "from Team Member to Fictional Reader", marked as worth checking
    - `Fictional Newcomer` "changed their own password"
    - "Fathom Administrator" "created the account for" `Fictional Newcomer`
  - **Notes:**

**Afterwards:** Run Reset the Database.
