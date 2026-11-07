---
title: "Manual Test: What Each Permission Allows"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["packages/shared/src/access.ts", "apps/web/src/layout.tsx", "apps/web/src/router.tsx", "apps/web/src/*-page.tsx", "apps/server/src/access.ts", "apps/server/src/data/**", "apps/server/src/routes/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/testing/roles-manual-test.md"]
last_updated: "2026-11-07"
---

# Manual Test: What Each Permission Allows

## Scope

Verifies, for each permission a role can grant, that an account holding only that permission, and any permission it needs, sees the pages and can take the actions the permission allows, and is not offered the next thing beyond it. The six permissions Fathom has not built yet are checked together.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place and the [Fictional Seed Data](../design/development-setup.md#fictional-seed-data) added.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R2).

## Test Accounts

R2 creates these accounts, with every other development account. They share one password, which R2 prints when it finishes.

- **Administrator account:** `fathom.administrator@fathom.test`, shown in Fathom as **Fathom Administrator**. It holds only the Administrator role, so it can edit roles.
- **Team Member account:** `team.member@fathom.test`, shown in Fathom as **Team Member**. It holds the Team Member role, so it can do exactly what Team Member grants.
- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. R3 uses it to add a column.
- **Engineering Director account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. R3 uses it to approve that column.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at the address the terminal prints, such as `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R2: Reset the Database

Use before the first test case and at the end of the last. This deletes every account and record in the development database, including anything added by hand, and puts every role back as Fathom starts it. Ask the owner before running it on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Start Fathom again (R0).

### R3: Add a Confidential Column

1. Sign in (P1) as `engineering.operations.manager@fathom.test`, and select **People** in the left-hand menu.
2. Select **New column**. Type `Offer letter` in **Name**, choose **Web link** in **Type**, select **Confidential** under **Visible to**, and select **Add column**.
3. Select the Publish button, which reads **Publish 4 changes**, and confirm that a notice reads **Published 4 changes.**
4. Sign in (P1) as `engineering.director@fathom.test`, select **Drafts** in the left-hand menu, and type `Offer letter` in the search box.
5. Select the entry's checkbox, then **Approve 1 draft**, then **Approve** in the dialog titled **Approve 1 draft?**.
6. Confirm that a notice reads **Approved 1 draft.**

### P1: Sign In

1. If someone is signed in, sign out first (P2).
2. On the **Sign in** page, enter the account's email address and the shared password.
3. Select **Sign in**.

### P2: Sign Out

1. Select the account button at the top right, which shows the account's name.
2. Select **Sign out**.

### P3: Open a Role

1. Select **Roles** under **Administration** in the left-hand menu.
2. Select **Edit** in the role's row.

### P4: Grant Team Member Only Some Permissions

1. Sign in (P1) as `fathom.administrator@fathom.test`, and open the **Team Member** role (P3).
2. Untick **View** on the **Plan**, **Allocations** and **Change history** rows. Confirm that no box in the grid is ticked, and that **Pages its holders see** says **None, apart from Help.**
3. Tick the boxes the test case names.
4. Select **Save**, then **Save changes**, and confirm that a green banner says **The role has been changed.**
5. Sign in (P1) as `team.member@fathom.test`.

### P5: Restore Team Member

1. Sign in (P1) as `fathom.administrator@fathom.test`, and open the **Team Member** role (P3).
2. Select **Restore template**, and confirm that the ticked boxes are **View** on **Plan**, **Allocations** and **Change history** only.
3. Select **Save**, then **Save changes**, and confirm that a green banner says **The role has been changed.**

### P6: Discard Your Unpublished Changes

1. Select the **⋯** button beside the Publish button, then **Discard all…**.
2. In the dialog titled **Discard 1 change?**, select **Discard**.
3. Confirm that a notice reads **Discarded 1 change.**, and that the Publish button is gone.

## Terms

- **Grid:** the table on the left of the role dialog, with an area in each row and the columns **View**, **Draft**, **Approve** and **Edit**.
- **Publish button:** the button in the top bar, beside your name, that reads **Publish** followed by a number of changes.
- **Search for:** type the person's name in the search box above the People table, so only their row is shown.
- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown beside a record's name. A hollow dot means the change is still unpublished.

## Test Cases

Run the test cases in order. Start with R0, then R2. Check each step whose expected result you see, and write anything else under its notes.

### Plan

#### PERM-01: View Plan Shows the Plan Without Changing It

**Preconditions:** Team Member granted only **View** on **Plan** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Overview** page is open. The menu shows **Overview**, **Projects** tagged **Later**, and **Releases** under **Plan**, **Drafts** under **People**, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Select **Releases**, then **Platform** in the table.
  - **Expected:** The side panel lists **Harbor 1**, **Harbor 2** and **Harbor 3** under **Releases**. There is no **New release…** button and no **New release stream** button.
  - **Notes:**

- [ ] **Step 3.** Select **Drafts**.
  - **Expected:** The page says **No drafts waiting for approval.**
  - **Notes:**

**Afterwards:** P5.

#### PERM-02: Edit Plan Makes Releases

**Preconditions:** Team Member granted only **Edit** on **Plan** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Select **Releases**, then **Platform** in the table, then **New release…** under **Releases** in the side panel.
  - **Expected:** A dialog titled **New release in Platform** opens. There is no **New release stream** button at the top right of the page.
  - **Notes:**

- [ ] **Step 2.** Type `Harbor 4` in **Name**, choose **28.1 (2028-01-01 to 2028-06-30)** as both the first and the last cycle, and select **Make release**.
  - **Expected:** A notification says **Drafted the new release.** Under **Releases**, a row reads **Harbor 4** with a hollow yellow dot and **Draft: added**. The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] **Step 3.** Discard your unpublished changes (P6).
  - **Expected:** **Harbor 4** is gone from the side panel.
  - **Notes:**

**Afterwards:** P5.

### People

#### PERM-03: View People Shows People Without Their Restricted Details

**Preconditions:** Team Member granted only **View** on **People** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **People** page is open. The menu shows **People** and **Drafts** under **People**, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Read the column headers, and the top right of the page.
  - **Expected:** **Start**, **End** and **Manager since** are not shown. There is no **New person** and no **New column** button.
  - **Notes:**

- [ ] **Step 3.** Search for **Viktoria Holmberg**.
  - **Expected:** No row is shown.
  - **Notes:**

**Afterwards:** P5.

#### PERM-04: Edit People Changes People

**Preconditions:** Team Member granted only **Edit** on **People** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** **New person** is at the top right, and there is no **New column** button. **Start**, **End** and **Manager since** are not shown.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**. Select the row's **Team name** cell, press Enter, replace the text with `Mobile apps team`, and press Enter.
  - **Expected:** The cell reads **Mobile apps team** and is yellow. The row has a hollow yellow dot and **Draft**. The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] **Step 3.** Discard your unpublished changes (P6).
  - **Expected:** The **Team name** cell reads **Mobile team**.
  - **Notes:**

**Afterwards:** P5.

### Restricted Details

#### PERM-05: View Restricted Details Shows Dates and Former Staff

**Preconditions:** Team Member granted only **View** on **People** and **View** on **Restricted details** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** **Start**, **End** and **Manager since** are shown. There is no **New person** button.
  - **Notes:**

- [ ] **Step 2.** Search for **Viktoria Holmberg**.
  - **Expected:** Her row is shown.
  - **Notes:**

**Afterwards:** P5.

#### PERM-06: Edit Restricted Details Changes Dates

**Preconditions:** Team Member granted only **Edit** on **People** and **Edit** on **Restricted details** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** **Start**, **End** and **Manager since** are shown. **New person** is at the top right, and there is no **New column** button.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**. Select the row's **Start** cell, press Enter, type `2010-01-04`, and press Enter.
  - **Expected:** The cell reads **2010-01-04** and is yellow. The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] **Step 3.** Discard your unpublished changes (P6).
  - **Expected:** The **Start** cell is no longer yellow.
  - **Notes:**

**Afterwards:** P5.

### Confidential Data

#### PERM-07: View Confidential Data Shows Confidential Columns

**Preconditions:** R2, then R3, then Team Member granted only **View** on **People** and **View** on **Confidential data** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** An **Offer letter** column is shown. **Start**, **End** and **Manager since** are not shown. There is no **New person** button.
  - **Notes:**

**Afterwards:** P5.

#### PERM-08: Edit Confidential Data Changes Confidential Values

**Preconditions:** R3 done since the last reset, as for PERM-07, then Team Member granted only **Edit** on **People** and **Edit** on **Confidential data** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** An **Offer letter** column is shown, and **New person** is at the top right. **Start**, **End** and **Manager since** are not shown.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**. Select the row's **Offer letter** cell, press Enter, type `https://example.test/offer` in **Address**, and press Enter.
  - **Expected:** The cell shows the address and is yellow. The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] **Step 3.** Discard your unpublished changes (P6).
  - **Expected:** The **Offer letter** cell is empty.
  - **Notes:**

**Afterwards:** P5.

### Drafts

#### PERM-09: Approve Drafts Approves What the Account Sees

**Preconditions:** The seed's draft of a new order for **Levels** still waiting, as after R2, then Team Member granted only **Approve** on **Drafts of every kind** and **View** on **Configuration** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the left-hand menu.
  - **Expected:** The menu shows **Releases** under **Plan**, **Drafts** and **Lists** under **People**, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Select **Drafts**, and type `new order for Levels` in the search box.
  - **Expected:** **Select all waiting**, **Reject…** and **Approve** are above the list. One entry is shown, ending **drafted a new order for Levels**, with a checkbox.
  - **Notes:**

- [ ] **Step 3.** Select the entry's checkbox, then **Approve 1 draft**, then **Approve** in the dialog titled **Approve 1 draft?**.
  - **Expected:** A notice reads **Approved 1 draft.** The page says **No drafts match the search.**
  - **Notes:**

- [ ] **Step 4.** Select **Lists**.
  - **Expected:** **Levels** has no mark. There is no **New list** button.
  - **Notes:**

**Afterwards:** P5.

### Configuration

#### PERM-10: View Configuration Shows Lists and Release Streams Without Changing Them

**Preconditions:** Team Member granted only **View** on **Configuration** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Select **Lists**.
  - **Expected:** **Skills** has a yellow dot and **Draft: added**. There is no **New list** button.
  - **Notes:**

- [ ] **Step 2.** Select **Releases**.
  - **Expected:** **Platform** and **Patches** are in the table. There is no **New release stream** button.
  - **Notes:**

- [ ] **Step 3.** Select **Drafts**.
  - **Expected:** Drafts are listed, with no checkboxes, and no **Select all waiting** or **Approve** button.
  - **Notes:**

**Afterwards:** P5.

#### PERM-11: Edit Configuration Changes Release Streams

**Preconditions:** Team Member granted only **Edit** on **Configuration** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Select **Releases**.
  - **Expected:** **New release stream** is at the top right of the page.
  - **Notes:**

- [ ] **Step 2.** Select **New release stream**, type `Testing Stream`, and select **Add stream**.
  - **Expected:** A notification says **Drafted the new release stream.** The table has a **Testing Stream** row with a hollow yellow dot and **Draft: added**. The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] **Step 3.** Discard your unpublished changes (P6), and select **Releases**.
  - **Expected:** **Testing Stream** is gone from the table.
  - **Notes:**

**Afterwards:** P5.

### Change History

#### PERM-12: View Change History Shows Only Changes to Data the Account Sees

**Preconditions:** Team Member granted only **View** on **Change history** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Change history** page is open and says **No changes to data you can see yet.** The menu shows **Change history** under **History**, and the **Help** section, and nothing else.
  - **Notes:**

**Afterwards:** P5.

### Access History

#### PERM-13: View Access History Shows the Access History

**Preconditions:** Team Member granted only **View** on **Access history** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Access history** page is open. The menu shows **Access history** under **History**, and the **Help** section, and nothing else.
  - **Notes:**

**Afterwards:** P5.

### Accounts

#### PERM-14: Edit Accounts Manages Accounts

**Preconditions:** Team Member granted only **Edit** on **Accounts** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Accounts** page is open. The menu shows **Accounts** under **Administration**, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Select **New account**.
  - **Expected:** A dialog titled **New account**, whose **Role** lists every role, each with its description, with **Team Member** chosen.
  - **Notes:**

- [ ] **Step 3.** Type `Test Account` in **Name** and `test.account@fathom.test` in **Email address**, and select **Create account**.
  - **Expected:** The dialog, now titled **Password for Test Account**, shows a password hidden as dots, which the eye button beside it shows as 20 letters and digits.
  - **Notes:**

- [ ] **Step 4.** Select **Done**.
  - **Expected:** A notice reads **Created the account for Test Account.** **Test Account** is in the table, with **Team Member** in its **Role** column.
  - **Notes:**

**Afterwards:** P5.

### Roles

#### PERM-15: Edit Roles Creates and Changes Roles

**Preconditions:** Team Member granted only **Edit** on **Roles** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Roles** page is open. The menu shows **Roles** under **Administration**, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Select **New role**, type `Test Role` as the name, and select **Create role**.
  - **Expected:** A green banner says **The role has been created.** **Test Role** is in the list, with **0** in the **Accounts** column.
  - **Notes:**

**Afterwards:** P5.

### Settings

#### PERM-16: Edit Settings Changes Fathom's Time Zone

**Preconditions:** Team Member granted only **Edit** on **Settings** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Settings** page is open. The menu shows **Settings** under **Administration**, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Type `Kolkata` in **Time zone**, choose **Asia/Kolkata** from the list, and select **Save**.
  - **Expected:** A green banner says **Fathom's time zone is now Asia/Kolkata.**
  - **Notes:**

**Afterwards:** P5.

### Not Built Yet

#### PERM-17: Permissions Not Built Yet Add Only the Capacity Entry

**Preconditions:** Team Member granted only **View** and **Edit** on **Allocations**, **Draft**, **Approve** and **Edit** on **Feature teams**, and **Draft** on **Drafts of every kind** (P4), signed in as `team.member@fathom.test`.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The Help **Roles** page is open. The menu shows **Capacity** tagged **Later** under **People**, and the **Help** section, and nothing else. There is no Publish button.
  - **Notes:**

**Afterwards:** P5.

### Putting Everything Back

#### PERM-18: Every Starting Role Is as Fathom Started It

**Preconditions:** All the test cases above run. Signed in (P1) as `fathom.administrator@fathom.test`.

- [ ] **Step 1.** Open each role in turn (P3), except **Test Role**, and select **Cancel** after each.
  - **Expected:** In every role's dialog, **Restore template** is turned off.
  - **Notes:**

- [ ] **Step 2.** Reset the database (R2), sign in (P1) as `fathom.administrator@fathom.test`, and select **Roles** under **Administration** in the left-hand menu.
  - **Expected:** The **Roles** page lists the roles as [Roles](../product/roles.md#starting-roles) sets out, and the Superuser role, with no **Test Role**.
  - **Notes:**
