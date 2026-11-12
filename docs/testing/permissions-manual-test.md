---
title: "Manual Test: What Each Permission Allows"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["packages/shared/src/access.ts", "apps/web/src/layout.tsx", "apps/web/src/router.tsx", "apps/web/src/*-page.tsx", "apps/server/src/access.ts", "apps/server/src/data/**", "apps/server/src/routes/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/testing/roles-manual-test.md"]
last_updated: "2026-11-11"
---

# Manual Test: What Each Permission Allows

## Scope

Verifies, for each permission a role can grant, that an account holding only that permission, and any permission it needs, sees the pages and can take the actions the permission allows, and is not offered the next thing beyond it. The permissions Fathom has not built yet are checked together.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as **Fathom Administrator**
- **Team Member:** `team.member@fathom.test`, with the permissions each test case grants it through Grant Team Member Only Some Permissions
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. Add a Confidential Column uses it to add a column.
- **Engineering Director:** `engineering.director@fathom.test`. Add a Confidential Column uses it to approve that column.

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database), [Open a Role](manual-test-basics.md#open-a-role) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes). It adds:

### Add a Confidential Column

1. Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`, and select the **People** page in the left-hand menu.
2. Select **New column**. Type `Offer letter` in **Name**, choose **Web link** in **Type**, choose **Confidential** under **Class**, and select **Add column**.
3. Select the Publish button, which reads **Publish 4 changes**, and confirm that a notice reads **Published 4 changes.**
4. Sign in as the Engineering Director, `engineering.director@fathom.test`, select the **Drafts** page in the left-hand menu, and type `Offer letter` in the search box.
5. Select the entry's checkbox, then **Approve 1 draft**, then **Approve** in the dialog titled **Approve 1 draft?**.
6. Confirm that a notice reads **Approved 1 draft.**

### Grant Team Member Only Some Permissions

1. Sign in as the Administrator, `fathom.administrator@fathom.test`, and open the **Team Member** role, as Open a Role describes.
2. Untick **View** on the **Plan**, **Allocations** and **Org chart** rows. Confirm that no box in the grid is ticked, and that **Pages its holders see** says **None, apart from Help.**
3. Tick the boxes the test case names.
4. Select **Save**, then **Save changes**, and confirm that a green banner says **The role has been changed.**
5. Sign in as the Team Member, `team.member@fathom.test`.

### Restore Team Member

1. Sign in as the Administrator, `fathom.administrator@fathom.test`, and open the **Team Member** role, as Open a Role describes.
2. Select **Restore template**, and confirm that the ticked boxes are **View** on **Plan**, **Allocations** and **Org chart** only.
3. Select **Save**, then **Save changes**, and confirm that a green banner says **The role has been changed.**

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms this test uses.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### Plan

#### PERM-01: View Plan Shows the Plan Without Changing It

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** Team Member granted only **View** on **Plan** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Overview** page is open. The menu shows **Overview**, **Projects**, **Features**, and **Releases** in the **Plan** section, **Drafts** in the **People** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Select **Releases**, then **Platform** in the table.
  - **Expected:**
    - Under **Releases**, the side panel lists **Harbor 1**, **Harbor 2 LTS**, **Harbor 3** and **Harbor 4**
    - A light green Live row is under **Harbor 2 LTS** and under **Harbor 3**
    - There is no **New release…** button and no **New release stream** button
  - **Notes:**

- [ ] **Step 3.** Select **Drafts**.
  - **Expected:**
    - Drafts of the plan are listed, among them one naming **Harbor 4**
    - No entry has a checkbox
    - There is no **Select all waiting** or **Approve** button
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-02: Edit Plan Makes Releases

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-01 ended with.

**Preconditions:** Team Member granted only **Edit** on **Plan** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Select **Releases**, then **Platform** in the table, then **New release…** under **Releases** in the side panel.
  - **Expected:** A dialog titled **New release in Platform** opens. There is no **New release stream** button at the top right of the page.
  - **Notes:**

- [ ] **Step 2.** Type `Harbor 5` in **Name**.
  - **Expected:** **Name** reads **Harbor 5**.
  - **Notes:**

- [ ] **Step 3.** In **First cycle**, choose Platform's third half-year cycle: the third in the list whose dates span six months.
  - **Expected:** **First cycle** shows that cycle.
  - **Notes:**

- [ ] **Step 4.** In **Last cycle**, choose the same cycle.
  - **Expected:** **Last cycle** shows that cycle.
  - **Notes:**

- [ ] **Step 5.** Select **Make release**.
  - **Expected:**
    - A notification says **Drafted the new release.**
    - Under **Releases**, a row reads **Harbor 5**, with a hollow yellow dot in its slot
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] **Step 6.** Run Discard the Unpublished Changes.
  - **Expected:** **Harbor 5** is gone from the side panel.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-03: Edit Features Opens No Further Pages

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-02 ended with.

**Preconditions:** Team Member granted only **Edit** on **Features** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The menu shows the same pages as in PERM-01 Step 1, since editing features brings seeing the plan. On **Releases**, **Platform** has no **New release…** button.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### People

#### PERM-04: View People Shows People Without Their Personal Details

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-03 ended with.

**Preconditions:** Team Member granted only **View** on **People** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **People** page is open. The menu shows **People** and **Drafts** in the **People** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Read the column headers, and the top right of the page.
  - **Expected:** **Start**, **End** and **Manager assigned** are not shown. There is no **New** and no **New column** button.
  - **Notes:**

- [ ] **Step 3.** Search for **Viktoria Holmberg**.
  - **Expected:** No row is shown.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-05: Edit People Changes People

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-04 ended with.

**Preconditions:** Team Member granted only **Edit** on **People** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** **New** is at the top right, and there is no **New column** button. **Start**, **End** and **Manager assigned** are not shown.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**. Select the row's **Team name** cell, press Enter, replace the text with `Mobile apps team`, and press Enter.
  - **Expected:**
    - The cell reads **Mobile apps team**, with a hollow yellow dot before it
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] **Step 3.** Run Discard the Unpublished Changes.
  - **Expected:** The **Team name** cell reads **Mobile team**.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-06: View Org Chart Shows the Chart Without People

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-05 ended with.

**Preconditions:** Team Member granted only **View** on **Org chart** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the left-hand menu, then select **Org chart** in the **People** section.
  - **Expected:** The menu shows **Org chart** in the **People** section, and the **Help** section, and nothing else. The chart shows each person's name, position, and the team they lead.
  - **Notes:**

- [ ] **Step 2.** Select any person's card.
  - **Expected:** The card opens nothing, and the page stays on the chart.
  - **Notes:**

- [ ] **Step 3.** Select the **Show only this team** button on a manager's card.
  - **Expected:** Only that manager's team is shown.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Personal Details

#### PERM-07: View Personal Details Shows Dates and Former Staff

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-06 ended with.

**Preconditions:** Team Member granted only **View** on **People** and **View** on **Personal details** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** **Start**, **End** and **Manager assigned** are shown. There is no **New** button.
  - **Notes:**

- [ ] **Step 2.** Search for **Viktoria Holmberg**.
  - **Expected:** Her row is shown.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-08: Edit Personal Details Changes Dates

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-07 ended with.

**Preconditions:** Team Member granted only **Edit** on **People** and **Edit** on **Personal details** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** **Start**, **End** and **Manager assigned** are shown. **New** is at the top right, and there is no **New column** button.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**. Select the row's **Start** cell, press Enter, type `2010-01-04`, and press Enter.
  - **Expected:**
    - The cell reads **2010-01-04**, with a hollow yellow dot before it
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] **Step 3.** Run Discard the Unpublished Changes.
  - **Expected:** The **Start** cell has no dot before it.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Confidential Data

#### PERM-09: View Confidential Data Shows Confidential Columns

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-08 ended with.

**Preconditions:** Reset the Database, then Add a Confidential Column, then Team Member granted only **View** on **People** and **View** on **Confidential data** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** An **Offer letter** column is shown. **Start**, **End** and **Manager assigned** are not shown. There is no **New** button.
  - **Notes:**

- [ ] **Step 2.** Select the **State** header, then **Filter…**. Tick **Request to hire** and **Approved to hire**, and press Esc.
  - **Expected:**
    - Only hire rows are shown
    - No row has a dot
    - **REQ-2050** is not among them
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-10: Edit Confidential Data Changes Confidential Values

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-09 ended with.

**Preconditions:** Add a Confidential Column done since the last reset, as for PERM-09, then Team Member granted only **Edit** on **People** and **Edit** on **Confidential data** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the column headers and the top right of the page.
  - **Expected:** An **Offer letter** column is shown, and **New** is at the top right. **Start**, **End** and **Manager assigned** are not shown.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**. Select the row's **Offer letter** cell, press Enter, type `https://example.test/offer` in **Address**, and press Enter.
  - **Expected:**
    - The cell shows the address, with a hollow yellow dot before it
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] **Step 3.** Run Discard the Unpublished Changes.
  - **Expected:** The **Offer letter** cell is empty.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Hiring Plan

#### PERM-11: View Hiring Plan Shows Planned Hires' Drafts

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-10 ended with.

**Preconditions:** Team Member granted only **View** on **People** and **View** on **Hiring plan** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Select the **State** header, then **Filter…**. Tick **Request to hire** and **Approved to hire**, and press Esc.
  - **Expected:**
    - Only hire rows are shown
    - **REQ-2050** is among them
    - **REQ-2050** has a yellow dot in its slot
    - **Backend engineer 1** has a yellow dot before its **State**, **Approved to hire**
    - There is no **New** button
  - **Notes:**

- [ ] **Step 2.** Read the column headers, then the **Start** cell of **REQ-2050**.
  - **Expected:** **Start** is shown, and **End** and **Manager assigned** are not. The **Start** cell of **REQ-2050** shows a date.
  - **Notes:**

- [ ] **Step 3.** Select **Clear all** above the table, and search for **Max Munk**.
  - **Expected:** The row's **Start** cell is empty.
  - **Notes:**

- [ ] **Step 4.** Select **Clear all** again, search for **Backend engineer 1**, select the row's **Name** cell, and type a letter.
  - **Expected:** No editor opens.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-12: Edit Hiring Plan Changes Planned Hires

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-11 ended with.

**Preconditions:** Team Member granted only **Edit** on **People** and **Edit** on **Hiring plan** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the top right of the page.
  - **Expected:** **New** is shown.
  - **Notes:**

- [ ] **Step 2.** Search for **Backend engineer 2**. Select the row's **Name** cell, press Enter, replace the text with `Backend engineer 3`, and press Enter.
  - **Expected:**
    - The cell reads **Backend engineer 3**, with a hollow yellow dot before it
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] **Step 3.** Run Discard the Unpublished Changes.
  - **Expected:** The **Name** cell reads **Backend engineer 2**.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Drafts

#### PERM-13: Approve Configuration Approves Drafts of Lists

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-12 ended with.

**Preconditions:** The seed's draft of a new order for **Levels** still waiting, as after Reset the Database, then Team Member granted only **View** and **Approve** on **Configuration** through Grant Team Member Only Some Permissions, signed in with this account.

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
  - **Expected:**
    - **Levels** has no dot
    - There is no **New list** button
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-14: Approve People Leaves Drafts of Other Areas to Another Approver

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-13 ended with.

**Preconditions:** Team Member granted only **View** and **Approve** on **People** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Select the **Drafts** page in the left-hand menu, and type `Skills` in the search box.
  - **Expected:** The entry **Engineering Operations Manager drafted changes to Silje Holm-Schrøder: Skills set to Rust** has a checkbox. The entries for the list **Skills**, the column **Skills** and its choices have none.
  - **Notes:**

- [ ] **Step 2.** Select the **Silje Holm-Schrøder** entry's checkbox, then **Approve 1 draft**.
  - **Expected:** A dialog titled **Another approver needed** reads **This role can't approve these drafts:** above *the column Skills*, *the list Skills* and *the choice Rust in Skills*, with only a **Close** button.
  - **Notes:**

- [ ] **Step 3.** Select **Close**.
  - **Expected:** The dialog closes, and the **Silje Holm-Schrøder** entry is still shown.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-15: Approve Their Own Drafts Lets the Account Approve What It Changed

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-14 ended with.

**Preconditions:** Team Member granted only **Edit** on **Plan**, **Approve** on **Releases** and **Approve** on **Their own drafts** through Grant Team Member Only Some Permissions, signed in with this account. **Releases** page open, with **Platform** selected in the streams table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor 1** row, then **Change…**.
  - **Expected:** A dialog titled **Change Harbor 1** opens.
  - **Notes:**

- [ ] **Step 2.** Replace the name with `Harbor One`, and select **Save**.
  - **Expected:** **Harbor One** has a hollow yellow dot before it.
  - **Notes:**

- [ ] **Step 3.** Select **Publish 1 change** in the top bar.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 4.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** An entry names **Harbor One**.
  - **Notes:**

- [ ] **Step 5.** Select the **Harbor One** entry's checkbox.
  - **Expected:** **Approve 1 draft** can be selected, and no line says another approver is needed.
  - **Notes:**

- [ ] **Step 6.** Select **Approve 1 draft**, then **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

**Afterwards:** Run Restore Team Member, then Reset the Database.

### Configuration

#### PERM-16: View Configuration Shows Lists and Release Streams Without Changing Them

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-15 ended with.

**Preconditions:** Team Member granted only **View** on **Configuration** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Select **Lists**.
  - **Expected:**
    - **Skills** has a yellow dot in its slot
    - There is no **New list** button
  - **Notes:**

- [ ] **Step 2.** Select **Releases**.
  - **Expected:** **Platform** and **Patches** are in the table. There is no **New release stream** button.
  - **Notes:**

- [ ] **Step 3.** Select **Drafts**.
  - **Expected:** Drafts are listed, with no checkboxes, and no **Select all waiting** or **Approve** button.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-17: Edit Configuration Changes Release Streams

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-16 ended with.

**Preconditions:** Team Member granted only **Edit** on **Configuration** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Select **Releases**.
  - **Expected:** **New release stream** is at the top right of the page.
  - **Notes:**

- [ ] **Step 2.** Select **New release stream**, type `Testing Stream`, and select **Add stream**.
  - **Expected:**
    - A notification says **Drafted the new release stream.**
    - The table has a **Testing Stream** row, with a hollow yellow dot in its slot
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] **Step 3.** Run Discard the Unpublished Changes, and select **Releases**.
  - **Expected:** **Testing Stream** is gone from the table.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Change History

#### PERM-18: View Change History Shows Only Changes to Data the Account Sees

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-17 ended with.

**Preconditions:** Team Member granted only **View** on **Change history** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Change history** page is open and says **No changes yet to data this account can see.** The menu shows **Change history** in the **History** section, and the **Help** section, and nothing else.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Access History

#### PERM-19: View Access History Shows the Access History

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-18 ended with.

**Preconditions:** Team Member granted only **View** on **Access history** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Access history** page is open. The menu shows **Access history** in the **History** section, and the **Help** section, and nothing else.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Accounts

#### PERM-20: View Accounts Shows Accounts Without Changing Them

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-19 ended with.

**Preconditions:** Team Member granted only **View** on **Accounts** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Accounts** page is open. The menu shows **Accounts** in the **Administration** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Look at the table and the top right of the page.
  - **Expected:** Every account is in the table with its role. There is no **New account** button and no **Edit** button in any row.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-21: Edit Accounts Manages Accounts

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-20 ended with.

**Preconditions:** Team Member granted only **Edit** on **Accounts** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Accounts** page is open. The menu shows **Accounts** in the **Administration** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Select **New account**.
  - **Expected:** A dialog titled **New account**, whose **Roles** lists every role, each with a tick box and its description, with only **Team Member** ticked.
  - **Notes:**

- [ ] **Step 3.** Type `Test Account` in **Name** and `test.account@fathom.test` in **Email address**, and select **Create account**.
  - **Expected:** The dialog, now titled **Password for Test Account**, shows a password hidden as dots, which the eye button beside it shows as 20 letters and digits.
  - **Notes:**

- [ ] **Step 4.** Select **Done**.
  - **Expected:** A notice reads **Created the account for Test Account.** **Test Account** is in the table, with **Team Member** in its **Roles** column.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Roles

#### PERM-22: View Roles Shows Roles Without Changing Them

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-21 ended with.

**Preconditions:** Team Member granted only **View** on **Roles** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Roles** page is open. The menu shows **Roles** in the **Administration** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Look at the table and the top right of the page, then select **View** in the **Team Member** row.
  - **Expected:** There is no **New role** button, and each row ends with **View** only. A dialog shows the role's name, what it is for and the grid, with every box fixed, and **Close** as its one button.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-23: Edit Roles Creates and Changes Roles

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-22 ended with.

**Preconditions:** Team Member granted only **Edit** on **Roles** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Roles** page is open. The menu shows **Roles** in the **Administration** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Select **New role**, type `Test Role` as the name, and select **Create role**.
  - **Expected:** A green banner says **The role has been created.** **Test Role** is in the list, with **0** in the **Accounts** column.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Settings

#### PERM-24: View Settings Shows Settings Without Changing Them

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-23 ended with.

**Preconditions:** Team Member granted only **View** on **Settings** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Settings** page is open. The menu shows **Settings** in the **Administration** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Look at **Time zone** and the **Passwords** panel.
  - **Expected:** Their values show but cannot be changed, and there is no **Save** button.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-25: Edit Settings Changes Fathom's Time Zone

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-24 ended with.

**Preconditions:** Team Member granted only **Edit** on **Settings** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Settings** page is open. The menu shows **Settings** in the **Administration** section, and the **Help** section, and nothing else.
  - **Notes:**

- [ ] **Step 2.** Type `Kolkata` in **Time zone**, choose **Asia/Kolkata** from the list, and select **Save**.
  - **Expected:** A green banner says **Fathom's time zone is now Asia/Kolkata.**
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Not Built Yet

#### PERM-26: Permissions Not Built Yet Add No Page

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-25 ended with.

**Preconditions:** Team Member granted only **View** on **Allocations** and **Draft** on **Drafts** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:**
    - The Help **Roles** page is open.
    - The menu shows only the **Help** section.
    - There is no Publish button.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Putting Everything Back

#### PERM-27: Every Starting Role Is as Fathom Started It

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account PERM-26 ended with. Step 2 signs in again with this account.

**Preconditions:** All the test cases above run. Signed in with this account.

- [ ] **Step 1.** Open each role in turn, as Open a Role describes, except **Test Role**, and select **Cancel** after each.
  - **Expected:** In every role's dialog, **Restore template** is turned off.
  - **Notes:**

- [ ] **Step 2.** Run Reset the Database, sign in as the Administrator, `fathom.administrator@fathom.test`, and select the **Roles** page in the left-hand menu.
  - **Expected:** The **Roles** page lists the roles as [Roles](../product/roles.md#starting-roles) sets out, and the Superuser role, with no **Test Role**.
  - **Notes:**
