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

Verifies, for each permission a role can grant, that an account holding only that permission, and any permission it needs, sees the pages and can take the actions the permission allows, and is not offered the next thing beyond it. The permissions Fathom has not built yet are checked together, one of them on its own.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place and the [Fictional Seed Data](../design/development-setup.md#fictional-seed-data) added.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R2).

## Test Accounts

R2 creates these accounts, with every other development account. They share one password, which R2 prints when it finishes.

- **Administrator account:** `fathom.administrator@fathom.test`, shown in Fathom as **Fathom Administrator**. It holds the Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Team Member account:** `team.member@fathom.test`, shown in Fathom as **Team Member**. It holds the Team Member role, as [Roles](../product/roles.md#starting-roles) sets out, with the permissions each test case grants it through P2.
- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out. R3 uses it to add a column.
- **Engineering Director account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. It holds the Engineering Director role, as [Roles](../product/roles.md#starting-roles) sets out. R3 uses it to approve that column.

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

1. Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`, and select **People** in the left-hand menu.
2. Select **New column**. Type `Offer letter` in **Name**, choose **Web link** in **Type**, select **Confidential** under **Visible to**, and select **Add column**.
3. Select the Publish button, which reads **Publish 4 changes**, and confirm that a notice reads **Published 4 changes.**
4. Sign in as the Engineering Director, `engineering.director@fathom.test`, select **Drafts** in the left-hand menu, and type `Offer letter` in the search box.
5. Select the entry's checkbox, then **Approve 1 draft**, then **Approve** in the dialog titled **Approve 1 draft?**.
6. Confirm that a notice reads **Approved 1 draft.**

### P1: Open a Role

1. Select **Roles** in the left-hand menu.
2. Select **Edit** in the role's row.

### P2: Grant Team Member Only Some Permissions

1. Sign in as the Administrator, `fathom.administrator@fathom.test`, and open the **Team Member** role (P1).
2. Untick **View** on the **Plan**, **Allocations** and **Org chart** rows. Confirm that no box in the grid is ticked, and that **Pages its holders see** says **None, apart from Help.**
3. Tick the boxes the test case names.
4. Select **Save**, then **Save changes**, and confirm that a green banner says **The role has been changed.**
5. Sign in as the Team Member, `team.member@fathom.test`.

### P3: Restore Team Member

1. Sign in as the Administrator, `fathom.administrator@fathom.test`, and open the **Team Member** role (P1).
2. Select **Restore template**, and confirm that the ticked boxes are **View** on **Plan**, **Allocations** and **Org chart** only.
3. Select **Save**, then **Save changes**, and confirm that a green banner says **The role has been changed.**

### P4: Discard Your Unpublished Changes

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

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** Team Member granted only **View** on **Plan** (P2), signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Overview** page is open. The menu shows **Overview**, **Projects** tagged **Later**, and **Releases** in the **Plan** section, **Drafts** in the **People** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Select **Releases**, then **Platform** in the table.
  - **Expected:** The side panel lists **Harbor 1**, **Harbor 2** and **Harbor 3** under **Releases**. There is no **New release…** button and no **New release stream** button.
  - **Notes:**

- [ ] **Step 3.** Select **Drafts**.
  - **Expected:** The page says **No drafts waiting for approval.**
  - **Notes:**

**Afterwards:** P3.

#### PERM-02: Edit Plan Makes Releases

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-01 ended with.

**Preconditions:** Team Member granted only **Edit** on **Plan** (P2), signed in with this account.

- [ ] **Step 1.** Select **Releases**, then **Platform** in the table, then **New release…** under **Releases** in the side panel.
  - **Expected:** A dialog titled **New release in Platform** opens. There is no **New release stream** button at the top right of the page.
  - **Notes:**

- [ ] **Step 2.** Type `Harbor 4` in **Name**, choose Platform's second half-year cycle, such as **28.1 (2028-01-01 to 2028-06-30)**, as both the first and the last cycle, and select **Make release**.
  - **Expected:** A notification says **Drafted the new release.** Under **Releases**, a row reads **Harbor 4** with a hollow yellow dot and **Draft: added**. The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] **Step 3.** Discard your unpublished changes (P4).
  - **Expected:** **Harbor 4** is gone from the side panel.
  - **Notes:**

**Afterwards:** P3.

#### PERM-03: Edit Features Is Not Built Yet

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-02 ended with.

**Preconditions:** Team Member granted only **Edit** on **Features** (P2), signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The menu shows the same pages as in PERM-01 Step 1, since editing features brings seeing the plan. On **Releases**, **Platform** has no **New release…** button.
  - **Notes:**

**Afterwards:** P3.

### People

#### PERM-04: View People Shows People Without Their Restricted Details

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-03 ended with.

**Preconditions:** Team Member granted only **View** on **People** (P2), signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **People** page is open. The menu shows **People** and **Drafts** in the **People** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Read the column headers, and the top right of the page.
  - **Expected:** **Start**, **End** and **Manager since** are not shown. There is no **New** and no **New column** button.
  - **Notes:**

- [ ] **Step 3.** Search for **Viktoria Holmberg**.
  - **Expected:** No row is shown.
  - **Notes:**

**Afterwards:** P3.

#### PERM-05: Edit People Changes People

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-04 ended with.

**Preconditions:** Team Member granted only **Edit** on **People** (P2), signed in with this account.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** **New** is at the top right, and there is no **New column** button. **Start**, **End** and **Manager since** are not shown.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**. Select the row's **Team name** cell, press Enter, replace the text with `Mobile apps team`, and press Enter.
  - **Expected:** The cell reads **Mobile apps team** and is yellow. The row has a hollow yellow dot and **Draft**. The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] **Step 3.** Discard your unpublished changes (P4).
  - **Expected:** The **Team name** cell reads **Mobile team**.
  - **Notes:**

**Afterwards:** P3.

#### PERM-06: View Org Chart Shows the Chart Without People

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-05 ended with.

**Preconditions:** Team Member granted only **View** on **Org chart** (P2), signed in with this account.

- [ ] **Step 1.** Look at the left-hand menu, then select **Org chart** in the **People** section.
  - **Expected:** The menu shows **Org chart** in the **People** section, and the **Help** section, and nothing else. The chart shows each person's name, position, and the team they lead.
  - **Notes:**

- [ ] **Step 2.** Select any person's card.
  - **Expected:** The card opens nothing, and the page stays on the chart.
  - **Notes:**

- [ ] **Step 3.** Select the **Show only this team** button on a manager's card.
  - **Expected:** Only that manager's team is shown.
  - **Notes:**

**Afterwards:** P3.

### Restricted Details

#### PERM-07: View Restricted Details Shows Dates and Former Staff

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-06 ended with.

**Preconditions:** Team Member granted only **View** on **People** and **View** on **Restricted details** (P2), signed in with this account.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** **Start**, **End** and **Manager since** are shown. There is no **New** button.
  - **Notes:**

- [ ] **Step 2.** Search for **Viktoria Holmberg**.
  - **Expected:** Her row is shown.
  - **Notes:**

**Afterwards:** P3.

#### PERM-08: Edit Restricted Details Changes Dates

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-07 ended with.

**Preconditions:** Team Member granted only **Edit** on **People** and **Edit** on **Restricted details** (P2), signed in with this account.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** **Start**, **End** and **Manager since** are shown. **New** is at the top right, and there is no **New column** button.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**. Select the row's **Start** cell, press Enter, type `2010-01-04`, and press Enter.
  - **Expected:** The cell reads **2010-01-04** and is yellow. The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] **Step 3.** Discard your unpublished changes (P4).
  - **Expected:** The **Start** cell is no longer yellow.
  - **Notes:**

**Afterwards:** P3.

### Confidential Data

#### PERM-09: View Confidential Data Shows Confidential Columns

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-08 ended with.

**Preconditions:** R2, then R3, then Team Member granted only **View** on **People** and **View** on **Confidential data** (P2), signed in with this account.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** An **Offer letter** column is shown. **Start**, **End** and **Manager since** are not shown. There is no **New** button.
  - **Notes:**

- [ ] **Step 2.** Select the **State** header, then **Filter…**. Tick **Request to hire** and **Approved to hire**, and press Esc.
  - **Expected:** Only hire rows are shown, none with a **Draft** mark, and **REQ-2050** is not among them.
  - **Notes:**

**Afterwards:** P3.

#### PERM-10: Edit Confidential Data Changes Confidential Values

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-09 ended with.

**Preconditions:** R3 done since the last reset, as for PERM-09, then Team Member granted only **Edit** on **People** and **Edit** on **Confidential data** (P2), signed in with this account.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** An **Offer letter** column is shown, and **New** is at the top right. **Start**, **End** and **Manager since** are not shown.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**. Select the row's **Offer letter** cell, press Enter, type `https://example.test/offer` in **Address**, and press Enter.
  - **Expected:** The cell shows the address and is yellow. The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] **Step 3.** Discard your unpublished changes (P4).
  - **Expected:** The **Offer letter** cell is empty.
  - **Notes:**

**Afterwards:** P3.

### Hiring Plan

#### PERM-11: View Hiring Plan Shows Planned Hires' Drafts

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-10 ended with.

**Preconditions:** Team Member granted only **View** on **People** and **View** on **Hiring plan** (P2), signed in with this account.

- [ ] **Step 1.** Select the **State** header, then **Filter…**. Tick **Request to hire** and **Approved to hire**, and press Esc.
  - **Expected:** Only hire rows are shown. **REQ-2050** is among them, and it and **Backend engineer 1** have a **Draft** mark. There is no **New** button.
  - **Notes:**

- [ ] **Step 2.** Read the column headers, then the **Start** cell of **REQ-2050**.
  - **Expected:** **Start** is shown, and **End** and **Manager since** are not. The **Start** cell of **REQ-2050** shows a date.
  - **Notes:**

- [ ] **Step 3.** Select **Clear all** above the table, and search for **Max Munk**.
  - **Expected:** The row's **Start** cell is empty.
  - **Notes:**

- [ ] **Step 4.** Select **Clear all** again, search for **Backend engineer 1**, select the row's **Name** cell, and type a letter.
  - **Expected:** No editor opens.
  - **Notes:**

**Afterwards:** P3.

#### PERM-12: Edit Hiring Plan Changes Planned Hires

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-11 ended with.

**Preconditions:** Team Member granted only **Edit** on **People** and **Edit** on **Hiring plan** (P2), signed in with this account.

- [ ] **Step 1.** Look at the top right of the page.
  - **Expected:** **New** is shown.
  - **Notes:**

- [ ] **Step 2.** Search for **Backend engineer 2**. Select the row's **Name** cell, press Enter, replace the text with `Backend engineer 3`, and press Enter.
  - **Expected:** The cell reads **Backend engineer 3** and is yellow. The row has a hollow yellow dot and **Draft**. The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] **Step 3.** Discard your unpublished changes (P4).
  - **Expected:** The **Name** cell reads **Backend engineer 2**.
  - **Notes:**

**Afterwards:** P3.

### Drafts

#### PERM-13: Approve Configuration Approves Drafts of Lists

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-12 ended with.

**Preconditions:** The seed's draft of a new order for **Levels** still waiting, as after R2, then Team Member granted only **View** and **Approve** on **Configuration** (P2), signed in with this account.

- [ ] **Step 1.** Look at the left-hand menu.
  - **Expected:** The menu shows **Releases** in the **Plan** section, **Drafts** and **Lists** in the **People** section, and the **Help** section, and nothing else.
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

**Afterwards:** P3.

#### PERM-14: Approve People Leaves Drafts of Other Areas to Another Approver

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-13 ended with.

**Preconditions:** Team Member granted only **View** and **Approve** on **People** (P2), signed in with this account.

- [ ] **Step 1.** Select **Drafts** in the left-hand menu, and type `Skills` in the search box.
  - **Expected:** The entry **Engineering Operations Manager drafted changes to Silje Holm-Schrøder: Skills set to Rust** has a checkbox. The entries for the list **Skills**, the column **Skills** and its choices have none.
  - **Notes:**

- [ ] **Step 2.** Select the **Silje Holm-Schrøder** entry's checkbox, then **Approve 1 draft**.
  - **Expected:** A dialog titled **Another approver needed** reads **Your role doesn't let you approve these drafts:** above *the column Skills*, *the list Skills* and *the choice Rust in Skills*, with only a **Close** button.
  - **Notes:**

- [ ] **Step 3.** Select **Close**.
  - **Expected:** The dialog closes, and the **Silje Holm-Schrøder** entry is still shown.
  - **Notes:**

**Afterwards:** P3.

#### PERM-15: Approve Their Own Drafts Lets the Account Approve What It Changed

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-14 ended with.

**Preconditions:** Team Member granted only **Edit** on **Plan**, **Approve** on **Releases** and **Approve** on **Their own drafts** (P2), signed in with this account. **Releases** page open, with **Platform** selected in the streams table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor 3** row, then **Change…**. Replace the name with `Harbor Three`, and select **Save**.
  - **Expected:** **Harbor Three** is followed by a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Select **Publish 1 change** in the top bar, then **Drafts** in the left-hand menu, and select the **Harbor Three** entry's checkbox.
  - **Expected:** **Approve 1 draft** can be selected, and no line says another approver is needed.
  - **Notes:**

- [ ] **Step 3.** Select **Approve 1 draft**, then **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

**Afterwards:** P3, then R2.

### Configuration

#### PERM-16: View Configuration Shows Lists and Release Streams Without Changing Them

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-15 ended with.

**Preconditions:** Team Member granted only **View** on **Configuration** (P2), signed in with this account.

- [ ] **Step 1.** Select **Lists**.
  - **Expected:** **Skills** has a yellow dot and **Draft: added**. There is no **New list** button.
  - **Notes:**

- [ ] **Step 2.** Select **Releases**.
  - **Expected:** **Platform** and **Patches** are in the table. There is no **New release stream** button.
  - **Notes:**

- [ ] **Step 3.** Select **Drafts**.
  - **Expected:** Drafts are listed, with no checkboxes, and no **Select all waiting** or **Approve** button.
  - **Notes:**

**Afterwards:** P3.

#### PERM-17: Edit Configuration Changes Release Streams

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-16 ended with.

**Preconditions:** Team Member granted only **Edit** on **Configuration** (P2), signed in with this account.

- [ ] **Step 1.** Select **Releases**.
  - **Expected:** **New release stream** is at the top right of the page.
  - **Notes:**

- [ ] **Step 2.** Select **New release stream**, type `Testing Stream`, and select **Add stream**.
  - **Expected:** A notification says **Drafted the new release stream.** The table has a **Testing Stream** row with a hollow yellow dot and **Draft: added**. The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] **Step 3.** Discard your unpublished changes (P4), and select **Releases**.
  - **Expected:** **Testing Stream** is gone from the table.
  - **Notes:**

**Afterwards:** P3.

### Change History

#### PERM-18: View Change History Shows Only Changes to Data the Account Sees

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-17 ended with.

**Preconditions:** Team Member granted only **View** on **Change history** (P2), signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Change history** page is open and says **No changes to data you can see yet.** The menu shows **Change history** in the **History** section, and the **Help** section, and nothing else.
  - **Notes:**

**Afterwards:** P3.

### Access History

#### PERM-19: View Access History Shows the Access History

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-18 ended with.

**Preconditions:** Team Member granted only **View** on **Access history** (P2), signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Access history** page is open. The menu shows **Access history** in the **History** section, and the **Help** section, and nothing else.
  - **Notes:**

**Afterwards:** P3.

### Accounts

#### PERM-20: View Accounts Shows Accounts Without Changing Them

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-19 ended with.

**Preconditions:** Team Member granted only **View** on **Accounts** (P2), signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Accounts** page is open. The menu shows **Accounts** in the **Administration** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Look at the table and the top right of the page.
  - **Expected:** Every account is in the table with its role. There is no **New account** button and no **Edit** button in any row.
  - **Notes:**

**Afterwards:** P3.

#### PERM-21: Edit Accounts Manages Accounts

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-20 ended with.

**Preconditions:** Team Member granted only **Edit** on **Accounts** (P2), signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Accounts** page is open. The menu shows **Accounts** in the **Administration** section, and the **Help** section, and nothing else.
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

**Afterwards:** P3.

### Roles

#### PERM-22: View Roles Shows Roles Without Changing Them

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-21 ended with.

**Preconditions:** Team Member granted only **View** on **Roles** (P2), signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Roles** page is open. The menu shows **Roles** in the **Administration** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Look at the table and the top right of the page, then select **View** in the **Team Member** row.
  - **Expected:** There is no **New role** button, and each row ends with **View** only. A dialog shows the role's name, what it is for and the grid, with every box fixed, and **Close** as its one button.
  - **Notes:**

**Afterwards:** P3.

#### PERM-23: Edit Roles Creates and Changes Roles

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-22 ended with.

**Preconditions:** Team Member granted only **Edit** on **Roles** (P2), signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Roles** page is open. The menu shows **Roles** in the **Administration** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Select **New role**, type `Test Role` as the name, and select **Create role**.
  - **Expected:** A green banner says **The role has been created.** **Test Role** is in the list, with **0** in the **Accounts** column.
  - **Notes:**

**Afterwards:** P3.

### Settings

#### PERM-24: View Settings Shows Settings Without Changing Them

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-23 ended with.

**Preconditions:** Team Member granted only **View** on **Settings** (P2), signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Settings** page is open. The menu shows **Settings** in the **Administration** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Look at **Time zone** and the **Passwords** panel.
  - **Expected:** Their values show but cannot be changed, and there is no **Save** button.
  - **Notes:**

**Afterwards:** P3.

#### PERM-25: Edit Settings Changes Fathom's Time Zone

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-24 ended with.

**Preconditions:** Team Member granted only **Edit** on **Settings** (P2), signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Settings** page is open. The menu shows **Settings** in the **Administration** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Type `Kolkata` in **Time zone**, choose **Asia/Kolkata** from the list, and select **Save**.
  - **Expected:** A green banner says **Fathom's time zone is now Asia/Kolkata.**
  - **Notes:**

**Afterwards:** P3.

### Not Built Yet

#### PERM-26: Permissions Not Built Yet Add Only the Capacity Entry

**Account:** Team Member, `team.member@fathom.test`, changed by P2 from the Administrator, the account PERM-25 ended with.

**Preconditions:** Team Member granted only **View** and **Edit** on **Allocations**, and **Draft** on **Drafts** (P2), signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The Help **Roles** page is open. The menu shows **Capacity** tagged **Later** in the **People** section, and the **Help** section, and nothing else. There is no Publish button.
  - **Notes:**

**Afterwards:** P3.

### Putting Everything Back

#### PERM-27: Every Starting Role Is as Fathom Started It

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account PERM-26 ended with. Step 2 signs in again with this account.

**Preconditions:** All the test cases above run. Signed in with this account.

- [ ] **Step 1.** Open each role in turn (P1), except **Test Role**, and select **Cancel** after each.
  - **Expected:** In every role's dialog, **Restore template** is turned off.
  - **Notes:**

- [ ] **Step 2.** Reset the database (R2), sign in as the Administrator, `fathom.administrator@fathom.test`, and select **Roles** in the left-hand menu.
  - **Expected:** The **Roles** page lists the roles as [Roles](../product/roles.md#starting-roles) sets out, and the Superuser role, with no **Test Role**.
  - **Notes:**
