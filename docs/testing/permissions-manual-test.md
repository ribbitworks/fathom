---
title: "Manual Test: What Each Permission Allows"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["packages/shared/src/access.ts", "packages/shared/src/page-access.ts", "apps/web/src/layout.tsx", "apps/web/src/router.tsx", "apps/web/src/*-page.tsx", "apps/server/src/access.ts", "apps/server/src/data/**", "apps/server/src/routes/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/testing/roles-manual-test.md"]
last_updated: "2026-11-17"
---

# Manual Test: What Each Permission Allows

## Scope

Verifies, for each permission a role can grant, that an account holding only that permission, and any permission it needs, sees the pages and can take the actions the permission allows, and is not offered the next thing beyond it. The permissions Fathom has not built yet are checked together.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as "Fathom Administrator"
- **Team Member:** `team.member@fathom.test`, with the permissions each test case grants it through Grant Team Member Only Some Permissions
- **Product Manager:** `product.manager@fathom.test`. PERM-22 uses it to approve a schedule.

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database), [Open a Role](manual-test-basics.md#open-a-role) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes). It adds:

### Grant Team Member Only Some Permissions

1. Sign in as the Administrator, `fathom.administrator@fathom.test`, and open the **Team Member** role, as Open a Role describes.
2. Untick **View** on the **Plan**, **Features and releases**, **Allocations**, **People** and **Feature teams** rows. Confirm that no box in the grid is ticked, apart from the greyed ones on **General**, and that **Sees** reads "Nothing."
3. Tick the boxes the test case names, in the order it names them.
4. Select **Save**, then **Save changes**, and confirm that a notification says "The role has been changed."
5. Sign in as the Team Member, `team.member@fathom.test`. Each test case's steps then say which page to select.

### Restore Team Member

1. Sign in as the Administrator, `fathom.administrator@fathom.test`, and open the **Team Member** role, as Open a Role describes.
2. Select **Restore template**, and confirm that the ticked boxes are **View** on **Plan**, **Features and releases**, **Allocations**, **People** and **Feature teams** only.
3. Select **Save**, then **Save changes**, and confirm that a notification says "The role has been changed."

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms this test uses.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### Plan

#### PERM-01: View Plan Shows the Plan Without Changing It

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** Team Member granted only **View** on **Plan** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `98FD` Look at the left-hand menu.
  - **Expected:**
    - **Plan** section: **Overview** and **Projects**
    - **History** section: **Drafts** and **Change history**
    - The **Help** section, and no other page
  - **Notes:**

- [ ] `DE22` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **All drafts** is the only tab beside the page's title, and is chosen
    - A row's **Record** reads 'Clinic Booking Rollout'
    - No row's **Record** reads 'Harbor 4 in Platform'
    - No row has a tick box
    - No buttons at the right of the page's heading
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-02: View Features and Releases Shows Them Without Changing Them

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-01 ended with.

**Preconditions:** Team Member granted only **View** on **Features and releases** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `6C7D` Look at the left-hand menu.
  - **Expected:**
    - **Plan** section: **Features** and **Releases**
    - **History** section: **Drafts** and **Change history**
    - The **Help** section, and no other page
  - **Notes:**

- [ ] `AA88` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The **Releases** tab shows the table of releases
    - There is no **New release** button
  - **Notes:**

- [ ] `6081` Read the rows under the heading 'Platform'.
  - **Expected:**
    - The rows read 'Harbor 2 LTS', 'Harbor 3' and 'Harbor 4'
    - A light green Live row is under 'Harbor 2 LTS' and under 'Harbor 3'
  - **Notes:**

- [ ] `3EDC` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **All drafts** is the only tab beside the page's title, and is chosen
    - A row's **Record** reads 'Harbor 4 in Platform'
    - No row has a tick box
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-03: Edit Features and Releases Makes Releases

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-02 ended with.

**Preconditions:** Team Member granted only **Edit** on **Features and releases** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `4D73` Look at the left-hand menu.
  - **Expected:**
    - **Plan** section: **Features** and **Releases**
    - **History** section: **Drafts** and **Change history**
    - The **Help** section, and no other page
  - **Notes:**

- [ ] `B4C1` Select the **Releases** page in the left-hand menu.
  - **Expected:** The **Releases** tab shows, with **New release** at the top right of the page.
  - **Notes:**

- [ ] `5F2C` Select **New release**.
  - **Expected:** A dialog titled "New release" opens.
  - **Notes:**

- [ ] `F361` Choose 'Platform' in **Schedule**.
  - **Expected:** **Schedule** reads 'Platform'.
  - **Notes:**

- [ ] `18CD` Type `Harbor 5` in **Name**.
  - **Expected:** **Name** reads `Harbor 5`.
  - **Notes:**

- [ ] `ED11` In **First cycle**, choose the third half-year cycle of 'Platform': the third in the list whose dates span six months.
  - **Expected:** **First cycle** shows that cycle.
  - **Notes:**

- [ ] `306D` Look at **Last cycle**.
  - **Expected:** **Last cycle** already shows the cycle chosen in **First cycle**.
  - **Notes:**

- [ ] `698F` Select **Make release**.
  - **Expected:**
    - A notification says "Drafted the new release."
    - Under the heading 'Platform', a row reads `Harbor 5`, with a hollow yellow dot in its slot
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] `A9A0` Run Discard the Unpublished Changes.
  - **Expected:** `Harbor 5` is gone from the table.
  - **Notes:**

- [ ] `A06D` Select the **Schedules** tab.
  - **Expected:** There is no **New schedule** button at the top right of the page.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### People

#### PERM-04: View People Shows People Without Their Personal Details

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-03 ended with.

**Preconditions:** Team Member granted only **View** on **People** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `11CE` Look at the left-hand menu.
  - **Expected:**
    - **People** section: **People** and **Org chart**
    - **History** section: **Drafts** and **Change history**
    - The **Help** section, and no other page
  - **Notes:**

- [ ] `97E7` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** table shows.
  - **Notes:**

- [ ] `BE13` Read the column headers, and the top right of the page.
  - **Expected:**
    - **Start**, **End** and **Manager assigned** are not shown
    - **Compensation band** and **Performance rating** are not shown
    - There is no **New person** and no **New column** button
  - **Notes:**

- [ ] `1BAF` Search for 'Viktoria Holmberg'.
  - **Expected:**
    - No row has 'Viktoria Holmberg' in its **Name** cell
    - Each row shown has 'Viktoria Holmberg' in its **Manager** cell
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-05: Edit People Changes People

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-04 ended with.

**Preconditions:** Team Member granted only **Edit** on **People** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `9DAE` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** table shows.
  - **Notes:**

- [ ] `F859` Look at the column headers and the top right of the page.
  - **Expected:**
    - **New person** is at the top right, and there is no **New column** button
    - **Start**, **End** and **Manager assigned** are not shown
  - **Notes:**

- [ ] `D68E` Search for 'Max Munk'.
  - **Expected:**
    - One row has 'Max Munk' in its **Name** cell
    - Each other row shown has 'Max Munk' in its **Manager** cell
  - **Notes:**

- [ ] `B7CD` In the row whose **Name** cell reads 'Max Munk', select the **Team name** cell, press Enter, replace the text with `Mobile apps team`, and press Enter.
  - **Expected:**
    - The cell reads `Mobile apps team`, with a hollow yellow dot before it
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] `D3A6` Run Discard the Unpublished Changes.
  - **Expected:** The **Team name** cell reads 'Mobile team'.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-06: View Feature Teams Shows Feature Teams

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-05 ended with.

**Preconditions:** Team Member granted only **View** on **People** and **View** on **Feature teams** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `E063` Look at the left-hand menu.
  - **Expected:**
    - **People** section: **People**, **Org chart** and **Feature assignments**
    - **History** section: **Drafts** and **Change history**
    - The **Help** section, and no other page
  - **Notes:**

- [ ] `C762` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart shows each person's name, position, and the team they lead.
  - **Notes:**

- [ ] `EEC1` Select **Feature teams** in the teams switch.
  - **Expected:**
    - The chart shows the feature teams, such as 'Payments core', each with its members
    - There is no **New feature team**, and no way to change a team
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Personal Details

#### PERM-07: View Personal Details Shows Dates and Former Staff

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-06 ended with.

**Preconditions:** Team Member granted only **View** on **People** and **View** on **Personal** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `89D3` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** table shows.
  - **Notes:**

- [ ] `E73F` Look at the column headers and the top right of the page.
  - **Expected:**
    - **Start**, **End** and **Manager assigned** are shown
    - There is no **New person** button
  - **Notes:**

- [ ] `F2BD` Search for 'Viktoria Holmberg'.
  - **Expected:**
    - One row has 'Viktoria Holmberg' in its **Name** cell, with a light green Live row under it
    - Each other row shown has 'Viktoria Holmberg' in its **Manager** cell, followed by a red **Left** box
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-08: Edit Personal Details Changes Dates

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-07 ended with.

**Preconditions:** Team Member granted only **Edit** on **People** and **Edit** on **Personal** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `5981` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** table shows.
  - **Notes:**

- [ ] `DD13` Look at the column headers and the top right of the page.
  - **Expected:**
    - **Start**, **End** and **Manager assigned** are shown
    - **New person** is at the top right, and there is no **New column** button
  - **Notes:**

- [ ] `7527` Search for 'Max Munk'.
  - **Expected:** One row has 'Max Munk' in its **Name** cell.
  - **Notes:**

- [ ] `98AC` In the row whose **Name** cell reads 'Max Munk', select the **Start** cell, press Enter, type `2010-01-04`, and press Enter.
  - **Expected:**
    - The cell reads `2010-01-04`, with a hollow yellow dot before it
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] `10DC` Run Discard the Unpublished Changes.
  - **Expected:** The **Start** cell of 'Max Munk' has no dot before it.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Confidential Data

#### PERM-09: View Confidential Data Shows Confidential Columns

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-08 ended with.

**Preconditions:** Team Member granted only **View** on **People** and **View** on **Confidential** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `F202` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** table shows.
  - **Notes:**

- [ ] `7D27` Look at the column headers and the top right of the page.
  - **Expected:**
    - **Compensation band** and **Performance rating** columns are shown
    - **Start**, **End** and **Manager assigned** are not shown
    - There is no **New person** button
  - **Notes:**

- [ ] `F8AA` Select the **State** column's name, then **Filter…**.
  - **Expected:** The choices include **Request to hire** and **Approved to hire**.
  - **Notes:**

- [ ] `1ED4` Tick **Request to hire**.
  - **Expected:** **Request to hire** is ticked.
  - **Notes:**

- [ ] `0062` Tick **Approved to hire**.
  - **Expected:** **Approved to hire** is ticked.
  - **Notes:**

- [ ] `7F60` Press Esc.
  - **Expected:**
    - Each row shown is a planned hire: its **State** cell reads **Request to hire** or **Approved to hire**
    - No row has a dot
    - No row has 'REQ-2050' in its **ID** cell
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-10: Edit Confidential Data Changes Confidential Values

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-09 ended with.

**Preconditions:** Team Member granted only **Edit** on **People** and **Edit** on **Confidential** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `1062` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** table shows.
  - **Notes:**

- [ ] `512C` Look at the column headers and the top right of the page.
  - **Expected:**
    - **Compensation band** and **Performance rating** columns are shown
    - **New person** is at the top right
    - **Start**, **End** and **Manager assigned** are not shown
  - **Notes:**

- [ ] `1B51` Search for 'Max Munk'.
  - **Expected:**
    - One row has 'Max Munk' in its **Name** cell
    - Its **Compensation band** cell reads 'Band 5'
  - **Notes:**

- [ ] `4B7E` In the row whose **Name** cell reads 'Max Munk', select the **Compensation band** cell, press Enter, choose 'Band 6', and press Enter.
  - **Expected:**
    - The cell reads 'Band 6', with a hollow yellow dot before it
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] `C05A` Run Discard the Unpublished Changes.
  - **Expected:** The **Compensation band** cell of 'Max Munk' reads 'Band 5', with no dot before it.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Hiring Plan

#### PERM-11: View Hiring Plan Shows Planned Hires' Drafts

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-10 ended with.

**Preconditions:** Team Member granted only **View** on **People**, **View** on **Hiring plan** and **View** on **Confidential** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `88C8` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** table shows.
  - **Notes:**

- [ ] `7FDA` Select the **State** column's name, then **Filter…**.
  - **Expected:** The choices include **Request to hire** and **Approved to hire**.
  - **Notes:**

- [ ] `4712` Tick **Request to hire**.
  - **Expected:** **Request to hire** is ticked.
  - **Notes:**

- [ ] `6847` Tick **Approved to hire**.
  - **Expected:** **Approved to hire** is ticked.
  - **Notes:**

- [ ] `B7D8` Press Esc.
  - **Expected:**
    - Each row shown is a planned hire: its **State** cell reads **Request to hire** or **Approved to hire**
    - One row has 'REQ-2050' in its **ID** cell
    - 'REQ-2050' has a yellow dot in its slot
    - 'Backend engineer 1' has a yellow dot before its **State**, "Approved to hire"
    - There is no **New person** button
  - **Notes:**

- [ ] `6BFB` Read the column headers, then the **Start** cell of 'REQ-2050'.
  - **Expected:**
    - **Start** is shown, and **End** and **Manager assigned** are not
    - The **Start** cell of 'REQ-2050' shows a date
  - **Notes:**

- [ ] `D4AA` Select **Clear all** above the table.
  - **Expected:** People and planned hires are shown again.
  - **Notes:**

- [ ] `5ABF` Search for 'Max Munk'.
  - **Expected:** In the row whose **Name** cell reads 'Max Munk', the **Start** cell is empty.
  - **Notes:**

- [ ] `A83B` Search for 'Backend engineer 1'.
  - **Expected:** One row has 'Backend engineer 1' in its **Name** cell.
  - **Notes:**

- [ ] `7E52` Select that row's **Name** cell, and type a letter.
  - **Expected:** No editor opens.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-12: Edit Hiring Plan Changes Planned Hires

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-11 ended with.

**Preconditions:** Team Member granted only **Edit** on **People**, **Edit** on **Hiring plan** and **Edit** on **Confidential** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `1FDD` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** table shows.
  - **Notes:**

- [ ] `0AF4` Look at the top right of the page.
  - **Expected:** **New person** is shown.
  - **Notes:**

- [ ] `D42A` Search for 'Backend engineer 2'.
  - **Expected:** One row has 'Backend engineer 2' in its **Name** cell.
  - **Notes:**

- [ ] `47A7` Select that row's **Name** cell, press Enter, replace the text with `Backend engineer 3`, and press Enter.
  - **Expected:**
    - The cell reads `Backend engineer 3`, with a hollow yellow dot before it
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] `50F5` Run Discard the Unpublished Changes.
  - **Expected:** The **Name** cell reads 'Backend engineer 2'.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Drafts

#### PERM-13: Approve Configuration Approves Drafts of Lists

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-12 ended with.

**Preconditions:** The seed's draft of a new order for 'Levels' still waiting, as after Reset the Database, then Team Member granted only **View** and **Approve** on **Configuration** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `9A70` Look at the left-hand menu.
  - **Expected:**
    - **Plan** section: **Releases**
    - **People** section: **Capacity**
    - **Administration** section: **Lists**
    - **History** section: **Drafts** and **Change history**
    - The **Help** section, and no other page
  - **Notes:**

- [ ] `2CA7` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `73D1` Type `Order of choices` in the search box.
  - **Expected:**
    - One row is shown, whose **Record** reads 'Levels', with a tick box before it
    - No buttons at the right of the page's heading
  - **Notes:**

- [ ] `0E6A` Tick that row's tick box.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `42A2` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `35A1` Select **Approve** in the dialog.
  - **Expected:**
    - A notification reads "Approved 1 draft."
    - The table reads "No matching drafts"
  - **Notes:**

- [ ] `C04B` Select the **Lists** page in the left-hand menu.
  - **Expected:**
    - 'Levels' has no dot
    - There is no **New list** button
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-14: Approve People Leaves Drafts of Other Areas to Another Approver

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-13 ended with.

**Preconditions:** Team Member granted only **View** and **Approve** on **People** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `9A3F` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `A824` Type `Skills` in the search box.
  - **Expected:**
    - A row's **Record** reads 'Silje Holm-Schrøder', with a tick box before it
    - Its **What changes** reads **Skills** set to `Rust`
    - Its **Made by** reads "Engineering Operations Manager"
    - No row's **Type** reads "List", "Column" or "Choice"
  - **Notes:**

- [ ] `5FA1` Tick the tick box of the row of 'Silje Holm-Schrøder'.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `219C` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:**
    - A dialog titled "Another approver needed" opens
    - It reads "This role can't approve these drafts:" above "the column Skills", "the list Skills" and "the choice Rust in Skills"
    - Its only button is **Close**
  - **Notes:**

- [ ] `86CC` Select **Close**.
  - **Expected:**
    - The dialog closes
    - The row of 'Silje Holm-Schrøder' is still shown
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-15: Approve Their Own Drafts Lets the Account Approve What It Changed

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-14 ended with.

**Preconditions:** Team Member granted only **Edit** on **Features and releases**, **Approve** on **Features and releases** and **Approve own drafts** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `673C` Select the **Features** page in the left-hand menu.
  - **Expected:** The table of features shows.
  - **Notes:**

- [ ] `68D6` In the row 'Scheduler API', select the **Name** cell, replace its text with `Scheduler Service`, then press Enter.
  - **Expected:** The cell reads `Scheduler Service`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `7FBC` Select **Publish 1 change** in the top bar.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `899B` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title
    - A row's **Record** reads `Scheduler Service`, with no box after it
  - **Notes:**

- [ ] `A8C2` Tick the tick box of the row of `Scheduler Service`.
  - **Expected:**
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**
    - **Approve 1 draft…** is not greyed out
    - No line says another approver is needed
  - **Notes:**

- [ ] `FAE2` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `3DD0` Select **Approve** in the dialog.
  - **Expected:** A notification reads "Approved 1 draft."
  - **Notes:**

**Afterwards:** Run Restore Team Member, then Reset the Database.

### Configuration

#### PERM-16: View Configuration Shows Lists and Schedules Without Changing Them

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-15 ended with.

**Preconditions:** Team Member granted only **View** on **Configuration** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `327E` Select the **Lists** page in the left-hand menu.
  - **Expected:**
    - 'Skills' has a yellow dot in its slot
    - There is no **New list** button
  - **Notes:**

- [ ] `D311` Select the **Releases** page in the left-hand menu, then the **Schedules** tab.
  - **Expected:**
    - 'Platform' and 'Patches' are in the table
    - There is no **New schedule** button
  - **Notes:**

- [ ] `C148` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **All drafts** is the only tab beside the page's title, and is chosen
    - The table lists drafts, and no row has a tick box
    - No buttons at the right of the page's heading
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-17: Edit Configuration Changes Schedules

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-16 ended with.

**Preconditions:** Team Member granted only **Edit** on **Configuration** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `B0BC` Select the **Releases** page in the left-hand menu, then the **Schedules** tab.
  - **Expected:** **New schedule** is at the top right of the page.
  - **Notes:**

- [ ] `D3C6` Select **New schedule**.
  - **Expected:** A dialog titled "New schedule" opens.
  - **Notes:**

- [ ] `43EC` Type `Testing Schedule` in **Name**.
  - **Expected:** **Name** reads `Testing Schedule`.
  - **Notes:**

- [ ] `9DA0` Select **Add schedule**.
  - **Expected:**
    - A notification says "Drafted the new schedule."
    - The table has a `Testing Schedule` row, with a hollow yellow dot in its slot
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] `2456` Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `CE3A` Select the **Releases** page in the left-hand menu, then the **Schedules** tab.
  - **Expected:** `Testing Schedule` is gone from the table.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-22: Edit Plan Changes Schedules, and Approve Plan Approves Them

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-17 ended with. Step `75C3` signs in as another account.

**Preconditions:** Team Member granted only **View** on **Features and releases** and **Edit** on **Plan** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `6D0D` Select the **Releases** page in the left-hand menu, then the **Schedules** tab.
  - **Expected:** **New schedule** is at the top right of the page.
  - **Notes:**

- [ ] `6D9B` Select **New schedule**.
  - **Expected:** A dialog titled "New schedule" opens.
  - **Notes:**

- [ ] `6F8F` Type `Testing Schedule` in **Name**.
  - **Expected:** **Name** reads `Testing Schedule`.
  - **Notes:**

- [ ] `7136` Select **Add schedule**.
  - **Expected:**
    - A notification says "Drafted the new schedule."
    - The table has a `Testing Schedule` row, with a hollow yellow dot in its slot
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] `7355` Select **Publish 1 change** in the top bar.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `75C3` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Product Manager".
  - **Notes:**

- [ ] `75FD` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `7D76` Type `Testing Schedule` in the search box.
  - **Expected:** One row is shown, whose **Record** reads `Testing Schedule`, with a tick box before it.
  - **Notes:**

- [ ] `7E26` Tick that row's tick box.
  - **Expected:**
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**
    - **Approve 1 draft…** is not greyed out
    - No line says another approver is needed
  - **Notes:**

- [ ] `7FA2` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `7FD3` Select **Approve** in the dialog.
  - **Expected:** A notification reads "Approved 1 draft."
  - **Notes:**

**Afterwards:** Run Restore Team Member, then Reset the Database.

### Change History

#### PERM-18: The Change History Comes With Each Area, Showing Only Its Changes

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-22 ended with.

**Preconditions:** Team Member granted only **View** on **Configuration** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `850A` Look at the left-hand menu.
  - **Expected:**
    - **Plan** section: **Releases**
    - **People** section: **Capacity**
    - **Administration** section: **Lists**
    - **History** section: **Drafts** and **Change history**
    - The **Help** section, and no other page
  - **Notes:**

- [ ] `B044` Select the **Change history** page in the left-hand menu.
  - **Expected:** Its entries name lists, such as 'Levels', and none names a person, a project or a release.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Administration

#### PERM-19: View Administration Shows Accounts, Roles, Settings and the Access History Without Changing Them

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-18 ended with.

**Preconditions:** Team Member granted only **View** on **Administration** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `D4C7` Look at the left-hand menu.
  - **Expected:**
    - **Administration** section: **Accounts**, **Roles** and **Settings**
    - **History** section: **Access history**
    - The **Help** section, and no other page
  - **Notes:**

- [ ] `07A4` Select the **Accounts** page in the left-hand menu.
  - **Expected:**
    - Every account is in the table with its role
    - There is no **New account** button
  - **Notes:**

- [ ] `FF34` Select the details button at the right of the **Name** cell of 'Product Manager'.
  - **Expected:**
    - A side panel headed **Product Manager** opens beside the table.
    - It has no **Edit…**, **Reset password…** or **Deactivate…** button.
  - **Notes:**

- [ ] `5E53` Select the **Roles** page in the left-hand menu.
  - **Expected:**
    - There is no **New role** button
    - Each row ends with **View** only
  - **Notes:**

- [ ] `84B6` Select **View** in the **Team Member** row.
  - **Expected:**
    - A dialog titled "Team Member" shows the role's name, its description and the grid
    - No box in the grid can be ticked or unticked
    - **Close** is its only button
  - **Notes:**

- [ ] `A9D6` Select **Close**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] `33FF` Select the **Settings** page in the left-hand menu.
  - **Expected:**
    - **Time zone** and the password settings show their values, which cannot be changed
    - There is no **Save** button
  - **Notes:**

- [ ] `B114` Select the **Access history** page in the left-hand menu.
  - **Expected:** The **Access history** page lists entries.
  - **Notes:**

**Afterwards:** Run Restore Team Member.

#### PERM-20: Edit Administration Manages Accounts, Roles and Settings

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-19 ended with.

**Preconditions:** Team Member granted only **Edit** on **Administration** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `B8CB` Select the **Accounts** page in the left-hand menu.
  - **Expected:**
    - **New account** is at the top right
  - **Notes:**

- [ ] `74E6` Select the details button at the right of the **Name** cell of 'Product Manager'.
  - **Expected:** The side panel headed **Product Manager** ends with **Edit…**, **Reset password…** and **Deactivate…**.
  - **Notes:**

- [ ] `84F5` Close the side panel with its **×**.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `B97C` Select **New account**.
  - **Expected:**
    - A dialog titled "New account" opens
    - **Roles** lists every role, each with a tick box and its description
    - Only **Team Member** is ticked
  - **Notes:**

- [ ] `A9B3` Type `Test Account` in **Name**.
  - **Expected:** **Name** reads `Test Account`.
  - **Notes:**

- [ ] `A5D6` Type `test.account@fathom.test` in **Email address**.
  - **Expected:** **Email address** reads `test.account@fathom.test`.
  - **Notes:**

- [ ] `95A4` Select **Create account**.
  - **Expected:** The dialog, now titled "Password for Test Account", shows a password hidden as dots.
  - **Notes:**

- [ ] `90EA` Select **Done**.
  - **Expected:**
    - A notification reads "Created the account for Test Account."
    - `Test Account` is in the table, with **Team Member** in its **Roles** column
  - **Notes:**

- [ ] `5D9A` Select the **Roles** page in the left-hand menu.
  - **Expected:** **New role** is at the top right.
  - **Notes:**

- [ ] `5CE2` Select **New role**.
  - **Expected:** A dialog titled "New role" opens.
  - **Notes:**

- [ ] `57EA` Type `Test Role` in **Name**.
  - **Expected:** **Name** reads `Test Role`.
  - **Notes:**

- [ ] `80B1` Select **Create role**.
  - **Expected:**
    - A notification says "The role has been created."
    - `Test Role` is in the list, with "0" in the **Accounts** column
  - **Notes:**

- [ ] `0B38` Select the **Settings** page in the left-hand menu.
  - **Expected:**
    - **Time zone** can be changed
    - A **Save** button is under it
  - **Notes:**

- [ ] `692F` Type `Kolkata` in **Time zone**, and choose **Asia/Kolkata** from the list.
  - **Expected:** **Time zone** shows **Asia/Kolkata**.
  - **Notes:**

- [ ] `86EF` Select **Save**.
  - **Expected:** A notification says "Fathom's time zone is now Asia/Kolkata."
  - **Notes:**

**Afterwards:** Run Restore Team Member.

### Putting Everything Back

#### PERM-21: Every Starting Role Is as Fathom Started It

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account PERM-20 ended with. Step `34A9` signs in again with this account.

**Preconditions:** All the test cases above run. Signed in with this account.

- [ ] `300F` Open each role in turn, as Open a Role describes, except `Test Role`, and select **Cancel** after each.
  - **Expected:** In every role's dialog, **Restore template** is turned off.
  - **Notes:**

- [ ] `34A9` Run Reset the Database, signing in again as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** Fathom opens, with the **Administration** section in the left-hand menu.
  - **Notes:**

- [ ] `DC4E` Select the **Roles** page in the left-hand menu.
  - **Expected:** The **Roles** page lists the roles as [Roles](../product/roles.md#starting-roles) sets out, and the Superuser role, with no `Test Role`.
  - **Notes:**
