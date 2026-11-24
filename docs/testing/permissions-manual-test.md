---
title: "Manual Test: What Each Permission Allows"
category: "How-To"
audience: "Contributors"
applies_to: ["packages/shared/src/access.ts", "packages/shared/src/page-access.ts", "apps/web/src/layout.tsx", "apps/web/src/router.tsx", "apps/web/src/signed-in-route.tsx", "apps/web/src/plan-routes.tsx", "apps/web/src/*-page.tsx", "apps/server/src/access.ts", "apps/server/src/data/**", "apps/server/src/routes/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/testing/roles-manual-test.md"]
last_updated: "2026-11-23"
---

# Manual Test: What Each Permission Allows

## Scope

Verifies, on Fathom's screens, that a role that only views sees the pages it may without the controls that change them, that editing people with the Personal, Confidential and hiring plan classes lets a role change each, and that an Approver of one area is told when drafts of another area need another approver.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as "Fathom Administrator"
- **Team Member:** `team.member@fathom.test`, with the permissions each test case grants it through Grant Team Member Only Some Permissions

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

### Viewing

#### PERM-04: Viewing Shows People and Releases Without Changing Them

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** The Team Member role as Fathom starts it, after Reset the Database, signed in with this account.

- [ ] `97E7` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** table shows.
  - **Notes:**

- [ ] `BE13` Read the column headers, and the top right of the page.
  - **Expected:**
    - **Start**, **End** and **Manager assigned** are not shown
    - **Compensation band** and **Performance rating** are not shown
    - There is no **New person** and no **New column** button
  - **Notes:**

- [ ] `AA88` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The **Releases** tab shows the table of releases
    - There is no **New release** button
  - **Notes:**

### Changing

#### PERM-05: Edit People Changes People, Their Classified Values and Planned Hires

**Account:** Team Member, `team.member@fathom.test`, the same as the account PERM-04 ended with, signed in again by Grant Team Member Only Some Permissions.

**Preconditions:** Team Member granted only **Edit** on **People**, **Edit** on **Personal**, **Edit** on **Confidential** and **Edit** on **Hiring plan** through Grant Team Member Only Some Permissions, signed in with this account.

- [ ] `9DAE` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** table shows.
  - **Notes:**

- [ ] `512C` Look at the column headers and the top right of the page.
  - **Expected:**
    - **Start**, **End** and **Manager assigned** are shown
    - **Compensation band** and **Performance rating** are shown
    - **New person** is at the top right, and there is no **New column** button
  - **Notes:**

- [ ] `1B51` Search for 'Max Munk'.
  - **Expected:**
    - One row has 'Max Munk' in its **Name** cell
    - Its **Compensation band** cell reads 'Band 5'
  - **Notes:**

- [ ] `98AC` In the row whose **Name** cell reads 'Max Munk', select the **Start** cell, press Enter, type `2010-01-04`, and press Enter.
  - **Expected:**
    - The cell reads `2010-01-04`, with a hollow yellow dot before it
    - The Publish button reads **Publish 1 change**
  - **Notes:**

- [ ] `4B7E` In the row whose **Name** cell reads 'Max Munk' and whose **Start** has a hollow yellow dot before it, select the **Compensation band** cell, press Enter, choose 'Band 6', and press Enter.
  - **Expected:** The cell reads 'Band 6', with a hollow yellow dot before it.
  - **Notes:**

- [ ] `D42A` Search for 'Backend engineer 2'.
  - **Expected:** One row has 'Backend engineer 2' in its **Name** cell.
  - **Notes:**

- [ ] `47A7` Select that row's **Name** cell, press Enter, replace the text with `Backend engineer 3`, and press Enter.
  - **Expected:** The cell reads `Backend engineer 3`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `50F5` Run Discard the Unpublished Changes.
  - **Expected:** The **Name** cell reads 'Backend engineer 2'.
  - **Notes:**

**Afterwards:** Open the **Views** menu above the table and select **Clear view**, then run Restore Team Member.

#### PERM-08: Edit Personal Details Changes Dates

Covered by [PERM-05](#perm-05-edit-people-changes-people-their-classified-values-and-planned-hires).

#### PERM-10: Edit Confidential Data Changes Confidential Values

Covered by [PERM-05](#perm-05-edit-people-changes-people-their-classified-values-and-planned-hires).

#### PERM-12: Edit Hiring Plan Changes Planned Hires

Covered by [PERM-05](#perm-05-edit-people-changes-people-their-classified-values-and-planned-hires).

### Drafts

#### PERM-14: Approve People Leaves Drafts of Other Areas to Another Approver

**Account:** Team Member, `team.member@fathom.test`, changed by Grant Team Member Only Some Permissions from the Administrator, the account PERM-05 ended with.

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

**Afterwards:** Open the **Views** menu above the table and select **Clear view**, then run Restore Team Member.
