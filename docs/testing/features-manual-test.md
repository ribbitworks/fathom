---
title: "Manual Test: Features"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/features.md"]
last_updated: "2026-11-19"
---

# Manual Test: Features

## Scope

Verifies the Features page: how the table of features looks and reads, its groups by cycle with Later, by release, by the month needed and by project, with a second level of grouping under the first and the +1 after a feature shown under two headings, the Release column, entering a month, customers and a note, the list of feature statuses, editing features as drafts, who may change them, how feature drafts show on the Drafts page and when a cycle changes length, columns added to Features, writing a note in New feature, a feature's effort, shown and typed in the unit chosen, its priority, size and risk, from their built-in lists, and moving any column. The projects and proposals that name a feature are verified in [Feature Links](feature-links-manual-test.md).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`
- **Team Member:** `team.member@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as "Second Engineering Operations Manager"
- **Engineering Director:** `engineering.director@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the left-hand menu, marks, the Group by menu and group headings. This test adds:

- **Group heading on Features:** it names a cycle or **Later**; grouped by release, a release or **Not released yet**; grouped by the month needed, a month or **No date**; grouped by project, a project or **No projects**.
- **+1:** the small grey mark after a feature's name in a grouped table, when the feature also shows under another heading. Pointing at it shows a tip naming the other heading.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### FEAT-01: The Table Reads Well

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] `085C` Select the **Features** page in the left-hand menu.
  - **Expected:**
    - The page is titled **Features**.
    - The table's columns read, from left to right:
      - **Name**
      - **Status**
      - **Description**
      - **Notes**
      - **Customers**
      - **Projects**
      - **Proposals**
      - **Priority**
      - **Needed by**
      - **Effort**
      - **Size**
      - **Risk**
      - **Release**
      - **Target cycle**
      - **Feature team**
      - **Staffed**
      - **Kind**
    - Beside the search box, the count reads "22 features".
    - The rows show as one list, with no group headings, and the button after **Metrics** reads **Group by**.
  - **Notes:**

- [ ] `F6D0` Look down the **Status** column.
  - **Expected:** Each row reads one of "Possible", "Planned", "In progress", "Done" or "Cancelled".
  - **Notes:**

- [ ] `6BDE` Look at the rows, the column headers and the lines between the rows.
  - **Expected:**
    - Every word is easy to read.
    - Each line between rows is one thin line running straight across the whole table.
  - **Notes:**

### FEAT-02: Features Group by Cycle, With Later Last

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-01 ended with.

**Preconditions:** **Features** page open, in one list.

- [ ] `05B1` Select **Group by** above the table, then **Cycle**.
  - **Expected:**
    - The button reads **Group by: Cycle**.
    - The group headings are clearly set apart from the rows.
    - Each line between rows, above and below the group headings too, is one thin line running straight across the whole table.
  - **Notes:**

- [ ] `3E03` Read the group headings from top to bottom.
  - **Expected:**
    - Each heading names the schedule and the cycle, such as **Platform: 27.1**.
    - Each heading has how many features it holds.
    - The headings for **Platform** come first, from the earliest cycle to the latest, then those for **Field Apps**, such as **Field Apps: FA26.2**, from the earliest to the latest.
    - The last heading is **Later**.
  - **Notes:**

- [ ] `13D8` Look under the heading **Later**.
  - **Expected:**
    - The rows 'Voice Notes', 'Partner Portal' and 'Shift Handover Notes' are there.
    - Each has **Target cycle** empty.
  - **Notes:**

- [ ] `7DF5` Type `offline` in the search box.
  - **Expected:**
    - Only the rows 'Offline Sync' and 'Offline Forms' show.
    - 'Offline Sync' is under a **Platform** heading, and 'Offline Forms' under a **Field Apps** heading.
    - No heading without a row shows.
  - **Notes:**

- [ ] `C44A` Empty the search box.
  - **Expected:**
    - Each heading names the schedule and the cycle, such as **Platform: 27.1**.
    - Each heading has how many features it holds.
    - The headings for **Platform** come first, from the earliest cycle to the latest, then those for **Field Apps**, such as **Field Apps: FA26.2**, from the earliest to the latest.
    - The last heading is **Later**.
    - All 22 rows show.
  - **Notes:**

- [ ] `B4B0` Select **Group by: Cycle** above the table, then **None** under **Group by**.
  - **Expected:**
    - The headings are gone.
    - The 22 rows show as one list.
  - **Notes:**

- [ ] `2AD1` Reload the page.
  - **Expected:** The rows still show as one list.
  - **Notes:**

- [ ] `4A6D` Select **Group by**, then **Cycle**.
  - **Expected:**
    - Each heading names the schedule and the cycle, such as **Platform: 27.1**.
    - Each heading has how many features it holds.
    - The headings for **Platform** come first, from the earliest cycle to the latest, then those for **Field Apps**, such as **Field Apps: FA26.2**, from the earliest to the latest.
    - The last heading is **Later**.
  - **Notes:**

### FEAT-03: A Planned Feature With No Feature Team Is Marked

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-02 ended with.

**Preconditions:** **Features** page open.

- [ ] `F55A` Look at the **Feature team** cell of the row 'Scheduler API'.
  - **Expected:**
    - The cell shows **No team** in red, with no box.
    - No dot is before the box.
    - The box starts in line with the text of the cells above and below.
  - **Notes:**

- [ ] `E379` Look at the **Feature team** cell of the row 'Partner Portal'.
  - **Expected:**
    - The cell is empty.
    - The cell has no box.
  - **Notes:**

### FEAT-04: Adding and Changing Features Makes Drafts

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-03 ended with.

**Preconditions:** **Features** page open, grouped by **Cycle**, as FEAT-02 leaves it.

- [ ] `C74B` Look at the empty row at the end of the table.
  - **Expected:** Every cell of the empty row is blank.
  - **Notes:**

- [ ] `D7BE` In the empty row at the end of the table, type `Fictional Reports` in **Name**, then press Enter.
  - **Expected:**
    - A hollow yellow dot is in the row's slot.
    - The row is tinted faint yellow.
    - **Status** reads "Possible".
    - The row stays where it is until the view next changes.
  - **Notes:**

- [ ] `954D` Reload the page.
  - **Expected:**
    - `Fictional Reports` is under the heading **Later**.
    - The hollow yellow dot is in its slot.
  - **Notes:**

- [ ] `24AE` In the row 'Report Builder', select the **Target cycle** cell.
  - **Expected:**
    - A list of cycles opens.
    - Each choice names its schedule and cycle.
  - **Notes:**

- [ ] `F7F1` Choose another cycle from the list.
  - **Expected:**
    - The new cycle has a hollow yellow dot before it.
    - A light green Live row under the row shows the old cycle.
    - A green dot is before the old cycle.
    - The row keeps its place until the view next changes.
  - **Notes:**

- [ ] `D44E` Select **Publish** in the top bar.
  - **Expected:** The hollow dots on both rows are now solid yellow.
  - **Notes:**

### FEAT-05: An Approver Approves a Feature's Draft

**Account:** Project Manager, `project.manager@fathom.test`, changed from FEAT-04.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] `ACE6` Select the **⋯** menu of the row 'Report Builder'.
  - **Expected:**
    - The menu names the feature and the change to **Target cycle**.
    - It offers **Approve draft…** and **Reject draft…**.
  - **Notes:**

- [ ] `B991` Select **Approve draft…**.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `EEE6` Select **Approve**.
  - **Expected:**
    - The row has no dot.
    - The row has no Live row under it.
    - Its **Target cycle** shows its new cycle.
  - **Notes:**

### FEAT-06: Feature Drafts Show on the Drafts Page

**Account:** Project Manager, `project.manager@fathom.test`, the account FEAT-05 ended with.

**Preconditions:** Signed in with this account.

- [ ] `F088` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - A row's **Record** reads `Fictional Reports`.
    - Its **Change** reads "Added".
    - Its **Type** reads "Feature".
    - Its **Made by** reads "Product Manager as Product Manager".
  - **Notes:**

### FEAT-07: Those Who Only See the Plan Cannot Change Features

**Account:** Team Member, `team.member@fathom.test`, changed from FEAT-06.

**Preconditions:** Signed in with this account.

- [ ] `FEEA` Select the **Features** page in the left-hand menu.
  - **Expected:**
    - The table shows.
    - There is no **New feature** button.
    - There is no empty row at the table's end.
  - **Notes:**

- [ ] `9F87` Double-click the **Status** cell of any row.
  - **Expected:** The cell does not open for editing.
  - **Notes:**

### FEAT-08: Features Follow a Cycle That Changes Length

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from FEAT-07. Step `5A7B` signs in as another account.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account.

- [ ] `360B` Run Discard the Unpublished Changes.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `347C` Select the **Releases** page in the left-hand menu, then the **Schedules** tab.
  - **Expected:**
    - The schedules table shows 'Platform'.
    - 'Platform' has no grey lock in its slot.
  - **Notes:**

- [ ] `AE97` Select the details button at the right of the first cell of the row for 'Platform'.
  - **Expected:** The side panel opens, headed 'Platform'.
  - **Notes:**

- [ ] `7E3A` In the side panel's **Cycles** table, select the pencil in the **Duration** cell of the row under the one marked **Current**.
  - **Expected:** A menu offers **This cycle only…** and **This and later cycles…**.
  - **Notes:**

- [ ] `0B9D` Select **This cycle only…**.
  - **Expected:** A dialog titled "Change the length of" that cycle opens.
  - **Notes:**

- [ ] `7DE5` Replace `3` in **Length** with `2`.
  - **Expected:** Below **New dates**:
    - **Releases that move** names 'Harbor 3' and 'Harbor 4'.
    - **Features that move** names 'Data Retention Controls' and 'Report Builder'.
  - **Notes:**

- [ ] `9BD3` Select **Change length**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] `0E88` Select **Publish** in the top bar.
  - **Expected:** The **Publish** button is gone from the top bar.
  - **Notes:**

- [ ] `5A7B` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `B621` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - Rows' **Record** read 'Data Retention Controls' and 'Report Builder', each with **Type** "Feature".
    - Rows whose **Type** reads "Cycles" have a **Record** starting 'Platform from'.
  - **Notes:**

- [ ] `4BD5` Tick the tick box of one row whose **Type** reads "Cycles".
  - **Expected:**
    - That row's tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `B27C` Select **Reject…** at the right of the page's heading.
  - **Expected:** The dialog lists "the feature Data Retention Controls" and "the feature Report Builder" among the drafts it includes.
  - **Notes:**

- [ ] `0B57` Type a reason in the dialog.
  - **Expected:** The dialog holds the reason typed.
  - **Notes:**

- [ ] `32B4` Select **Reject** in the dialog.
  - **Expected:**
    - The dialog closes.
    - No row's **Record** reads 'Data Retention Controls' or 'Report Builder'.
  - **Notes:**

- [ ] `E856` Select **All drafts** beside the page's title.
  - **Expected:**
    - The rows of 'Data Retention Controls' and 'Report Builder' each start with a red dot in a ring.
    - The row of the cycles ticked in `4BD5` starts with a red dot in a ring.
  - **Notes:**

### FEAT-09: The Keyboard Moves Across Group Headings

**Account:** Product Manager, `product.manager@fathom.test`, changed from FEAT-08.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **Features** page open.

- [ ] `73D9` Select **Group by** above the table, then **Cycle**.
  - **Expected:** The rows are under headings that name cycles.
  - **Notes:**

- [ ] `E810` Select the **Name** cell of the last row under a group heading.
  - **Expected:** The cell is selected.
  - **Notes:**

- [ ] `9F0C` Press the Down arrow.
  - **Expected:**
    - The selection moves to the **Name** cell of the first row under the next heading.
    - The selection does not stop on the heading.
  - **Notes:**

### FEAT-10: Needed By Takes a Month and Shows Its Name

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-09 ended with.

**Preconditions:** **Features** page open.

- [ ] `4B53` In the row 'Usage Alerts', select the **Needed by** cell.
  - **Expected:** The cell is selected.
  - **Notes:**

- [ ] `E29F` Type `203003`.
  - **Expected:** The cell reads "2030-03".
  - **Notes:**

- [ ] `9DD5` Press Enter.
  - **Expected:**
    - The cell reads "Mar 2030".
    - A hollow yellow dot is before it.
    - A light green Live row under the row shows an empty **Needed by**.
  - **Notes:**

- [ ] `5AF3` In the row 'Scheduler API', select the **Needed by** cell, type `203013`, then press Enter.
  - **Expected:**
    - The value is refused.
    - The message reads "Needed by: use a month such as 2027-03".
  - **Notes:**

- [ ] `3A74` Press Escape.
  - **Expected:** The cell is empty again.
  - **Notes:**

### FEAT-11: Customers, the Description and the Note

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-10 ended with.

**Preconditions:** **Features** page open.

- [ ] `53DF` In the row 'Scheduler API', select the **Customers** cell and pick the first two customers offered.
  - **Expected:**
    - The cell shows both customers' names.
    - A hollow yellow dot is before them.
  - **Notes:**

- [ ] `5C0E` In the row 'Scheduler API', select the **Description** cell, replace its text with 201 letters, then press Enter.
  - **Expected:**
    - The value is refused.
    - The message reads "Description too long".
  - **Notes:**

- [ ] `6C7F` Press Escape.
  - **Expected:** The description is back as it was.
  - **Notes:**

- [ ] `C664` In the row 'Offline Sync', select the **Notes** cell.
  - **Expected:**
    - A side panel titled **Notes** opens beside the table.
    - It shows the note with bold words and a bulleted list, formatted as written.
  - **Notes:**

- [ ] `616D` Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `48D7` Look at the **Notes** cell of the row 'Offline Sync'.
  - **Expected:** The cell shows the start of the note as plain words.
  - **Notes:**

### FEAT-12: Features Group by the Month They Are Needed

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-11 ended with.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **Features** page opened from the left-hand menu, in one list.

- [ ] `BD96` Select **Group by** above the table, then **Needed by**.
  - **Expected:**
    - The button reads **Group by: Needed by**.
    - Each heading names a month and year, such as **Mar 2027**.
    - Each heading has how many features it holds.
    - The headings run from the earliest month to the latest.
    - The last heading is **No date**.
  - **Notes:**

- [ ] `75F4` Reload the page.
  - **Expected:** The headings are still by month.
  - **Notes:**

- [ ] `9088` Select **Group by: Needed by**.
  - **Expected:**
    - **Earliest first** and **Latest first** are listed after the groupings, under a line.
    - **Earliest first** is ticked.
  - **Notes:**

- [ ] `D124` Select **Latest first**.
  - **Expected:**
    - The first heading is **No date**.
    - The headings after it run from the latest month to the earliest.
    - The button still reads **Group by: Needed by**.
  - **Notes:**

- [ ] `0F5D` Choose **Board** beside the **Features** heading.
  - **Expected:**
    - The first row label at the left of the board is **No date**.
    - The row labels under it run from the latest month to the earliest.
  - **Notes:**

- [ ] `9B69` Choose **Table** beside the **Features** heading.
  - **Expected:** The first heading is **No date**.
  - **Notes:**

- [ ] `424C` Select **Group by: Needed by**, then **None** under **Group by**.
  - **Expected:**
    - The headings are gone.
    - The rows show as one list.
    - The button reads **Group by**, naming no grouping.
  - **Notes:**

- [ ] `E74A` Select **Group by**, then **Cycle**.
  - **Expected:**
    - The headings name cycles again, from the earliest to the latest.
    - The last heading is **Later**.
  - **Notes:**

### FEAT-13: Feature Statuses Are a List With Meanings

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FEAT-12.

**Preconditions:** Signed in with this account.

- [ ] `B342` Select the **Lists** page in the left-hand menu.
  - **Expected:**
    - The **Lists** page opens.
    - **Feature statuses** is in its table.
  - **Notes:**

- [ ] `05D1` Select **Feature statuses** in the table.
  - **Expected:**
    - The list's name has a grey **Built in** box after it.
    - Its choices are, in order, **Possible**, **Planned**, **In progress**, **Done** and **Cancelled**.
    - Each choice is beside a meaning of the same name.
  - **Notes:**

- [ ] `0EF5` Read the lines under the choices.
  - **Expected:**
    - They invite renaming, adding and retiring.
    - They say what each of the five meanings is.
    - The lines end with "Keep at least one choice for each."
  - **Notes:**

- [ ] `7D26` In the empty row of the choices, type `Long shot`.
  - **Expected:** The empty row holds `Long shot`.
  - **Notes:**

- [ ] `FECE` Choose the meaning **Possible** in the same row.
  - **Expected:** The row's meaning reads "Possible".
  - **Notes:**

- [ ] `B856` Press Enter.
  - **Expected:**
    - `Long shot` is added.
    - A hollow yellow dot is before it.
    - Its meaning is "Possible".
  - **Notes:**

### FEAT-14: A Feature's Details Open Beside the Table

Covered by [SCOPE-01](scope-history-manual-test.md#scope-01-a-features-customers-and-notes-in-its-details) in Scope History.

### FEAT-15: Those Who Only See the Plan See Added Columns

**Account:** Team Member, `team.member@fathom.test`, changed from FEAT-13.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account.

- [ ] `E35C` Select the **Features** page in the left-hand menu.
  - **Expected:** The page is titled **Features**.
  - **Notes:**

- [ ] `64D3` Scroll right to the **Kind** column.
  - **Expected:**
    - There is no **New column** button.
    - The row 'Offline Sync' shows 'New'.
    - 'Mobile Approvals' shows 'Improvement'.
    - 'Data Retention Controls' shows 'Fix'.
    - 'Report Builder' shows 'New'.
    - 'Usage Alerts' is empty.
  - **Notes:**

- [ ] `E244` Open the **Kind** column menu.
  - **Expected:**
    - The menu offers **Move left** and **Move right**.
    - It has no **Edit column…**.
  - **Notes:**

### FEAT-16: A Column Is Added to Features as a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FEAT-15.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] `034F` Select **New column**.
  - **Expected:**
    - The **New column** dialog opens.
    - It has the fields **Name**, **Type**, **List**, **Several choices** and **Must be filled in**.
    - There is no **Offered on planned hires**.
  - **Notes:**

- [ ] `931E` Open the **List** box.
  - **Expected:**
    - 'Kind' is offered.
    - No list marked **Personal** or **Confidential** is offered.
  - **Notes:**

- [ ] `407C` Set **Type** to **Number**.
  - **Expected:**
    - The **List** box and **Several choices** go.
    - No box asking who may see the values appears.
  - **Notes:**

- [ ] `E03F` Type `Fictional Score` in **Name**.
  - **Expected:** **Name** holds `Fictional Score`.
  - **Notes:**

- [ ] `D48D` Select **Add column**.
  - **Expected:**
    - The dialog closes.
    - A `Fictional Score` column is added at the right end of the table.
    - The column is tinted faint yellow.
    - A hollow yellow dot is before `Fictional Score` in its header.
  - **Notes:**

- [ ] `2C67` Double-click the `Fictional Score` cell of any row.
  - **Expected:** The cell does not open for editing while the column is a draft.
  - **Notes:**

- [ ] `F38D` Open the `Fictional Score` column menu.
  - **Expected:**
    - The menu offers **Edit column…**, **Move left** and **Move right**.
  - **Notes:**

- [ ] `5FEE` Select **Edit column…**.
  - **Expected:**
    - The **Edit column** dialog opens.
    - **Type** is greyed out.
    - There is no **Remove column** button.
  - **Notes:**

- [ ] `1BF3` Select **Cancel**.
  - **Expected:**
    - The dialog closes.
    - Nothing has changed.
  - **Notes:**

- [ ] `933E` Select **Publish** in the top bar.
  - **Expected:** The dot before `Fictional Score` is now solid yellow.
  - **Notes:**

### FEAT-17: An Approver Approves a Column on Features

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from FEAT-16.

**Preconditions:** Signed in with this account.

- [ ] `3CA1` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - A row's **Record** reads `Fictional Score on Features`, with **Type** "Column".
    - Its **Made by** reads "Engineering Operations Manager as Workforce Administrator".
  - **Notes:**

- [ ] `1F59` Select the **Features** page in the left-hand menu.
  - **Expected:** The page is titled **Features**.
  - **Notes:**

- [ ] `C4A4` Open the `Fictional Score` column menu.
  - **Expected:** The menu offers **Approve…** and **Reject…**.
  - **Notes:**

- [ ] `21F1` Select **Approve…**.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `293A` Select **Approve**.
  - **Expected:**
    - The `Fictional Score` header has no dot.
    - The column is no longer tinted.
    - `Fictional Score` stays at the right end of the table, after **Kind**.
  - **Notes:**

### FEAT-18: A Value in an Added Column Is Part of a Feature's Draft

**Account:** Product Manager, `product.manager@fathom.test`, changed from FEAT-17.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] `DD3D` Double-click the `Fictional Score` cell of the row 'Usage Alerts', type `3.5` and press Enter.
  - **Expected:**
    - The cell shows `3.5`.
    - A hollow yellow dot is before it.
    - A light green Live row under the row has an empty `Fictional Score` cell.
  - **Notes:**

- [ ] `2D6E` Double-click the **Kind** cell of the same row, and choose 'Fix'.
  - **Expected:**
    - The cell shows 'Fix'.
    - The Live row's **Kind** cell stays empty.
  - **Notes:**

- [ ] `F82A` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen.
  - **Notes:**

- [ ] `DE24` Select **Not published** beside the page's title.
  - **Expected:** Under **What changes**, the row whose **Record** reads 'Usage Alerts' names both changes:
    - `Fictional Score` to `3.5`.
    - **Kind** to 'Fix'.
  - **Notes:**

- [ ] `841B` Select the **Features** page in the left-hand menu.
  - **Expected:** The page is titled **Features**.
  - **Notes:**

- [ ] `C498` Point at the row 'Usage Alerts', and select the details button at the right of its **Name** cell.
  - **Expected:**
    - The side panel lists `Fictional Score` and **Kind**.
    - Each shows the drafted value, with the live value under it.
  - **Notes:**

- [ ] `DB07` Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `14F1` Select **Publish** in the top bar.
  - **Expected:** The dots before `3.5` and 'Fix' on the row 'Usage Alerts' are now solid yellow.
  - **Notes:**

- [ ] `BDC2` Select **New feature**.
  - **Expected:** The form offers **Kind** and `Fictional Score`.
  - **Notes:**

- [ ] `1F6F` Select **Cancel**.
  - **Expected:** The form closes.
  - **Notes:**

- [ ] `9B59` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `3E9D` Select the **Features** page in the left-hand menu.
  - **Expected:** The page is titled **Features**.
  - **Notes:**

- [ ] `5E03` Open the **⋯** menu of the row 'Usage Alerts', and select **Approve draft…**.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `D8C8` Select **Approve**.
  - **Expected:**
    - The row has no dot.
    - The row has no Live row under it.
    - It still shows `3.5` and 'Fix'.
  - **Notes:**

### FEAT-19: Deleting a Column Removes It From Features

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from FEAT-18.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] `8B94` Open the `Fictional Score` column menu and select **Edit column…**.
  - **Expected:**
    - The **Edit column** dialog opens.
    - It has a red **Remove column** button.
  - **Notes:**

- [ ] `0D9A` Select **Remove column**.
  - **Expected:**
    - The dialog closes.
    - A notice reads "Removed the Fictional Score column."
    - The column stays in the table.
    - A hollow yellow dot is before its name.
    - The column's name is struck through.
  - **Notes:**

- [ ] `C886` Select **Publish** in the top bar.
  - **Expected:** The dot before `Fictional Score` is now solid yellow.
  - **Notes:**

- [ ] `09CF` Open the `Fictional Score` column menu, and select **Approve…**.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `B052` Select **Approve**.
  - **Expected:**
    - The `Fictional Score` column is gone.
    - The table ends with **Kind**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-20: New Feature Writes a Note in Its Own Panel

**Account:** Product Manager, `product.manager@fathom.test`, changed from FEAT-19.

**Preconditions:** Restore the Seed Data run after FEAT-19. Signed in with this account. **Features** page open.

- [ ] `9AB0` Select **New feature**.
  - **Expected:**
    - The **New feature** panel opens beside the table.
    - Each label is at the left of its row.
    - The rows are under the headings **Details** and **Columns**.
    - The **Notes** row has "None" as its value.
    - It has a change button at its right.
    - There is no text box for the note.
  - **Notes:**

- [ ] `8E63` Type `Fictional Atlas` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `BCF1` Select the open button in the **Notes** row.
  - **Expected:**
    - A second panel opens under **New feature**, titled "Notes for New feature".
    - **Note**, **Editor** and **Markdown** are at its top.
    - **Editor** is chosen.
    - A toolbar is above the text.
    - `Fictional Atlas` is still in **Name**.
  - **Notes:**

- [ ] `7CD5` Type `First words` in the editor.
  - **Expected:** The editor holds `First words`.
  - **Notes:**

- [ ] `ECC4` Select the words `First words` in the editor.
  - **Expected:** The words are highlighted.
  - **Notes:**

- [ ] `0C65` Select **Bold** in the toolbar.
  - **Expected:** `First words` is bold in the editor.
  - **Notes:**

- [ ] `C7AB` In the **New feature** panel, change **Name** to `Fictional Atlas Two`.
  - **Expected:**
    - **Name** shows what was typed.
    - The note's panel stays open.
  - **Notes:**

- [ ] `1D2A` Select **Save** in the note's panel.
  - **Expected:**
    - The note's panel closes.
    - The **Notes** row shows `First words` in bold.
    - **Name** still reads `Fictional Atlas Two`.
  - **Notes:**

- [ ] `3CFC` Select the open button in the **Notes** row.
  - **Expected:**
    - The note's panel opens.
    - It shows the note as it reads.
  - **Notes:**

- [ ] `77D6` Select **Editor**.
  - **Expected:** The editor shows `First words`.
  - **Notes:**

- [ ] `3A7F` Type more words in the editor.
  - **Expected:** The words appear in the editor.
  - **Notes:**

- [ ] `ACB6` Select **Cancel** in the **New feature** panel.
  - **Expected:**
    - A box asks "Discard the new feature?"
    - It offers **Keep adding** and **Discard**.
  - **Notes:**

- [ ] `B298` Select **Keep adding**.
  - **Expected:**
    - The box closes.
    - Both panels stay open.
  - **Notes:**

- [ ] `A098` Select **Cancel** in the note's panel.
  - **Expected:**
    - The note's panel closes.
    - The **Notes** row still shows only `First words`.
  - **Notes:**

- [ ] `886E` Select **Add** at the foot of the **New feature** panel.
  - **Expected:**
    - The feature is added as a draft.
    - Its details show beside the table.
    - `First words` is in bold under **Notes**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-21: Effort Shows in the Unit Chosen

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-20 ended with.

**Preconditions:** Restore the Seed Data run after FEAT-20. **Features** page open.

- [ ] `B9CA` Find the **Effort** column, after **Needed by**, and look at the rows 'Audit Export', 'Usage Alerts' and 'Scheduler API'.
  - **Expected:**
    - 'Audit Export' reads "316 h".
    - 'Usage Alerts' reads "424 h".
    - 'Scheduler API' is empty.
  - **Notes:**

- [ ] `2B82` Rest the pointer on "316 h".
  - **Expected:** A tooltip reads "316 hours", and nothing more.
  - **Notes:**

- [ ] `707E` Select the **Release** cell of 'Audit Export'.
  - **Expected:** The cell is selected.
  - **Notes:**

- [ ] `160C` Press the Right arrow key once.
  - **Expected:**
    - The **Effort** cell of 'Audit Export' is selected.
    - A tooltip beside it reads "316 hours".
  - **Notes:**

- [ ] `9BDC` Open the column menu of **Effort**.
  - **Expected:**
    - Under **Show in**, the menu lists **Hours**, **Person-days (8 hours)**, **Person-weeks (8h / PD, 5 days / PW)**, **Person-months (8h / PD, 20 days / PM)** and **Person-quarters (8h / PD, 60 days / PQ)**, in that order.
    - A tick is beside **Hours** only.
    - Under **Decimal places**, it lists **0**, **1** and **2**.
    - A tick is beside **2** only.
    - It has no **Metrics**.
  - **Notes:**

- [ ] `55AF` Select **Person-days (8 hours)**.
  - **Expected:**
    - The menu closes.
    - 'Audit Export' reads "39.5 PD".
    - 'Usage Alerts' reads "53 PD".
  - **Notes:**

- [ ] `970D` Rest the pointer on "39.5 PD".
  - **Expected:** A tooltip reads "316 hours".
  - **Notes:**

- [ ] `920C` Open the column menu of **Effort**, and select **Person-weeks (8h / PD, 5 days / PW)**.
  - **Expected:**
    - 'Audit Export' reads "8 PW".
    - 'Usage Alerts' reads "10.6 PW".
  - **Notes:**

- [ ] `1FFD` Rest the pointer on "8 PW".
  - **Expected:** A tooltip reads "316 hours, rounded up".
  - **Notes:**

- [ ] `EDEA` Open the column menu of **Effort**, and select **Person-months (8h / PD, 20 days / PM)**.
  - **Expected:**
    - 'Audit Export' reads "2 PM".
    - 'Usage Alerts' reads "2.65 PM".
    - 'Bulk Import' reads "1.5 PM".
  - **Notes:**

- [ ] `6ACA` Open the column menu of **Effort**, and select **Person-quarters (8h / PD, 60 days / PQ)**.
  - **Expected:**
    - 'Audit Export' reads "0.67 PQ".
    - 'Usage Alerts' reads "0.89 PQ".
    - 'Bulk Import' reads "0.5 PQ".
  - **Notes:**

- [ ] `EA7D` Open the column menu of **Effort**, and select **Person-months (8h / PD, 20 days / PM)**.
  - **Expected:** 'Usage Alerts' reads "2.65 PM".
  - **Notes:**

- [ ] `0F3F` Open the column menu of **Effort**, and select **1** under **Decimal places**.
  - **Expected:**
    - 'Audit Export' reads "2 PM".
    - 'Usage Alerts' reads "2.7 PM".
    - 'Bulk Import' reads "1.5 PM".
  - **Notes:**

- [ ] `F7C5` Rest the pointer on "2.7 PM".
  - **Expected:** A tooltip reads "424 hours, rounded up".
  - **Notes:**

- [ ] `7B2E` Open the column menu of **Effort**, and select **0** under **Decimal places**.
  - **Expected:**
    - 'Usage Alerts' reads "3 PM".
    - 'Bulk Import' reads "2 PM".
  - **Notes:**

- [ ] `66F0` Reload the page.
  - **Expected:** **Effort** still shows person-months with no decimal places: 'Usage Alerts' reads "3 PM".
  - **Notes:**

- [ ] `D9D3` Open the **Views** menu.
  - **Expected:** It lists **Units: Effort in person-months to 0 decimal places**.
  - **Notes:**

- [ ] `E449` Press Escape.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `0A18` Open the **Views** menu, and select **Units: Effort in person-months to 0 decimal places**.
  - **Expected:** 'Audit Export' reads "316 h" again.
  - **Notes:**

### FEAT-22: Effort Is Typed in the Unit Shown and Rounded Up

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-21 ended with.

**Preconditions:** **Features** page open, **Effort** shown in hours to 2 decimal places, as the column menu of **Effort** shows with ticks beside **Hours** and **2**.

- [ ] `9BF3` Open the column menu of **Effort**, and select **Person-days (8 hours)**.
  - **Expected:** 'Audit Export' reads "39.5 PD".
  - **Notes:**

- [ ] `45AB` In the row 'Scheduler API', select the **Effort** cell, type `2.2`, then press Enter.
  - **Expected:**
    - The cell reads "2.5 PD".
    - A hollow yellow dot is before it.
    - A light green Live row under the row shows an empty **Effort**.
  - **Notes:**

- [ ] `FFD8` Select the **Effort** cell of 'Scheduler API' reading "2.5 PD", above the Live row, and press Enter.
  - **Expected:**
    - A field opens in the cell holding "2.5".
    - "PD" is after it.
  - **Notes:**

- [ ] `A9FB` Press Enter without changing the field.
  - **Expected:**
    - The field closes.
    - The cell still reads "2.5 PD".
  - **Notes:**

- [ ] `9DC2` Select the **Effort** cell of 'Scheduler API' reading "2.5 PD" again, type `-1`, then press Enter.
  - **Expected:**
    - The value is refused.
    - The message reads "Effort: use 0 or more".
  - **Notes:**

- [ ] `CDAD` Press Escape.
  - **Expected:** The cell reads "2.5 PD" again.
  - **Notes:**

- [ ] `95FD` Select **Show details** in the **⋯** menu of 'Scheduler API'.
  - **Expected:**
    - The details panel opens beside the table.
    - Its **Effort** row reads "2.5 person-days (20 hours)".
  - **Notes:**

- [ ] `D165` Select the change button in the **Effort** row.
  - **Expected:**
    - A field opens holding "2.5".
    - A menu beside it reads "person-days".
  - **Notes:**

- [ ] `01D7` Press Tab twice, past the field's **×**.
  - **Expected:**
    - The menu beside the field has focus.
    - The field stays open.
  - **Notes:**

- [ ] `ED15` Press Escape.
  - **Expected:**
    - The field closes.
    - The **Effort** row still reads "2.5 person-days (20 hours)".
  - **Notes:**

- [ ] `BBDD` Select the change button in the **Effort** row.
  - **Expected:**
    - A field opens holding "2.5".
    - A menu beside it reads "person-days".
  - **Notes:**

- [ ] `CF2C` Select **hours** in the menu beside the field.
  - **Expected:**
    - The field now holds "20".
    - The menu reads "hours".
  - **Notes:**

- [ ] `6EA5` Change the field to `28`, then press Enter.
  - **Expected:**
    - The **Effort** row reads "3.5 person-days (28 hours)".
    - In the table 'Scheduler API' reads "3.5 PD".
  - **Notes:**

- [ ] `9DFC` Select the change button in the **Effort** row.
  - **Expected:**
    - A field opens holding "3.5".
    - A menu beside it reads "person-days".
  - **Notes:**

- [ ] `C1C3` Press Tab twice.
  - **Expected:** The menu beside the field has focus.
  - **Notes:**

- [ ] `70BA` Using only the keyboard, choose **person-weeks** in the menu.
  - **Expected:**
    - The menu reads "person-weeks".
    - The field holds "0.8".
  - **Notes:**

- [ ] `6D53` Press Shift+Tab twice.
  - **Expected:** The field has focus.
  - **Notes:**

- [ ] `E4AD` Type `1` in place of what the field holds.
  - **Expected:** The field holds `1`.
  - **Notes:**

- [ ] `6B90` Press Tab three times, until neither the field nor the menu has focus.
  - **Expected:**
    - The field closes.
    - The **Effort** row reads "5 person-days (40 hours)".
  - **Notes:**

- [ ] `A7B1` Close the details panel.
  - **Expected:**
    - The panel closes.
    - 'Scheduler API' reads "5 PD".
  - **Notes:**

- [ ] `121F` Open the column menu of **Effort**.
  - **Expected:** It ticks **Person-days (8 hours)**.
  - **Notes:**

- [ ] `EF23` Select **Hours**.
  - **Expected:** 'Scheduler API' reads "40 h".
  - **Notes:**

- [ ] `18EF` Select **Show details** in the **⋯** menu of 'Scheduler API'.
  - **Expected:** The panel's **Effort** row reads "40 hours", with nothing after it.
  - **Notes:**

- [ ] `B976` Close the details panel.
  - **Expected:** The panel closes.
  - **Notes:**

- [ ] `66EC` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen.
  - **Notes:**

- [ ] `C8C2` Select **Not published** beside the page's title.
  - **Expected:** In the row whose **Record** reads 'Scheduler API', **What changes** reads "Effort set to 40 hours".
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-23: New Feature Takes Effort in a Unit Chosen

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-22 ended with.

**Preconditions:** Restore the Seed Data run after FEAT-22. **Features** page open.

- [ ] `F8F2` Open the column menu of **Effort**, and select **Person-weeks (8h / PD, 5 days / PW)**.
  - **Expected:** 'Audit Export' reads "8 PW".
  - **Notes:**

- [ ] `584A` Select **New feature**.
  - **Expected:**
    - The **New feature** panel opens.
    - Its **Effort** row has an empty field.
    - A menu beside it reads "person-weeks".
  - **Notes:**

- [ ] `4B1D` Type `Fictional Effort` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `EED6` Type `2` in **Effort**.
  - **Expected:** **Effort** shows `2`.
  - **Notes:**

- [ ] `3D99` Open the menu beside **Effort**.
  - **Expected:** It lists **hours**, **person-days**, **person-weeks**, **person-months** and **person-quarters**.
  - **Notes:**

- [ ] `C208` Select **person-days**.
  - **Expected:**
    - The menu reads "person-days".
    - **Effort** still holds `2`.
    - The table's **Effort** column still shows person-weeks.
  - **Notes:**

- [ ] `47C5` Select **Add** at the foot of the **New feature** panel.
  - **Expected:**
    - The feature is added as a draft.
    - Its details show beside the table.
    - The **Effort** row reads "0.4 person-weeks (16 hours)".
    - In the table, `Fictional Effort` reads "0.4 PW".
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-24: Features Group by Release

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-23 ended with.

**Preconditions:** Restore the Seed Data run after FEAT-23. **Features** page opened from the left-hand menu, in one list.

- [ ] `DC19` Select **Group by** above the table.
  - **Expected:**
    - The menu lists, from the top:
      - **None**, ticked
      - **Cycle**
      - **Release**
      - **Needed by**
      - **Status**
      - **Customers**
      - **Projects**
      - **Proposals**
      - **Priority**
      - **Size**
      - **Risk**
      - **Feature team**
      - **Staffed**
      - **Kind**
    - There is no **Then by** label.
    - There is no **Clear grouping**.
  - **Notes:**

- [ ] `CD88` Select **Release**.
  - **Expected:**
    - The button reads **Group by: Release**.
    - The headings and their counts read, from top to bottom:
      - **Platform: Harbor 1**, "1"
      - **Platform: Harbor 2 LTS**, "4"
      - **Platform: Harbor 3**, "2"
      - **Field Apps: Lantern 1**, "2"
      - **Field Apps: Lantern 2**, "7"
      - **Platform: Not released yet**, "2"
      - **Field Apps: Not released yet**, "1"
      - **Later**, "3"
    - Each 'Harbor' and 'Lantern' heading is followed by a comma, "ships" and a date with its day, month and year, such as "ships 31 Mar 2027".
    - No heading names 'Harbor 4', 'Lantern 3' or a 'Patches' release.
  - **Notes:**

- [ ] `7D6A` In the row 'Report Builder', under **Platform: Harbor 3**, select the **Target cycle** cell and choose the cycle two after the one it shows.
  - **Expected:**
    - The new cycle has a hollow yellow dot before it.
    - A light green Live row under the row shows the old cycle.
    - The row stays under **Platform: Harbor 3** until the view next changes.
  - **Notes:**

- [ ] `E829` Reload the page.
  - **Expected:**
    - **Platform: Not released yet** now counts "3".
    - **Platform: Harbor 3** now counts "1".
    - 'Report Builder' is under **Platform: Not released yet**.
    - The Live row of 'Report Builder' under it shows the old cycle.
  - **Notes:**

- [ ] `13D0` Select **Group by: Release**, then **None** under **Group by**.
  - **Expected:**
    - The headings are gone.
    - The rows show as one list.
    - The button reads **Group by**, naming no grouping.
  - **Notes:**

- [ ] `85CC` Select **Group by**, then **Cycle**.
  - **Expected:**
    - The headings name cycles again.
    - The last heading is **Later**.
  - **Notes:**

- [ ] `26A0` Find the **Release** column, before **Target cycle**, and look at the rows 'Report Builder', 'Offline Sync' and 'Voice Notes'.
  - **Expected:**
    - In the row of 'Report Builder', **Release** reads "Platform: Not released yet".
    - In its Live row, **Release** reads "Platform: Harbor 3".
    - 'Offline Sync' reads "Platform: Harbor 2 LTS", with no date.
    - The **Release** of 'Voice Notes' is empty.
  - **Notes:**

- [ ] `C184` Select the details button at the right of the **Name** cell of 'Report Builder'.
  - **Expected:**
    - The side panel lists **Release** before **Target cycle**.
    - **Release** reads "Platform: Not released yet".
    - It is underlined as a link.
  - **Notes:**

- [ ] `F521` Select **Platform: Not released yet** in the side panel.
  - **Expected:**
    - The **Releases** page opens on its **Schedules** tab.
    - The 'Platform' side panel is open beside its table.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-25: Priority, Size and Risk

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-24 ended with. Step `B09A` signs in as another account.

**Preconditions:** Restore the Seed Data run after FEAT-24, which ends on the **Releases** page. Signed in with this account. **Features** page open from the left-hand menu, as it opens: in one list, nothing in the search box and no filters.

- [ ] `D750` Read the **Priority**, **Size** and **Risk** cells of 'Offline Sync'.
  - **Expected:**
    - **Priority** reads "Critical".
    - **Size** reads "L".
    - **Risk** reads "High".
  - **Notes:**

- [ ] `967C` Read the **Priority**, **Size** and **Risk** cells of 'Voice Notes'.
  - **Expected:**
    - **Priority** reads "Low".
    - **Size** is empty.
    - **Risk** is empty.
  - **Notes:**

- [ ] `5C6D` Point at the row 'Voice Notes', and select the details button at the right of its **Name** cell.
  - **Expected:**
    - Under **Planning**, **Priority** reads "Low".
    - **Size** reads "None", dimmed.
    - **Risk** reads "None", dimmed.
  - **Notes:**

- [ ] `B488` Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `F7EB` Select the **Size** cell of 'Scheduler API', and press Enter.
  - **Expected:**
    - A list of choices opens.
    - Its options read, from the top:
      - **None**, with a line under it
      - **XS**
      - **S**
      - **M**
      - **L**
      - **XL**
  - **Notes:**

- [ ] `0B6B` Choose **L**.
  - **Expected:**
    - The cell shows "L".
    - A hollow yellow dot is before it.
    - A light green Live row under the row reads "M" under **Size**.
  - **Notes:**

- [ ] `10CC` Select the **Risk** cell of 'Scheduler API', and press Enter.
  - **Expected:**
    - A list of choices opens.
    - Its options read, from the top:
      - **None**, with a line under it
      - **Low**
      - **Medium**
      - **High**
    - Each choice is on one line.
  - **Notes:**

- [ ] `7E1F` Press Esc.
  - **Expected:**
    - The list closes.
    - The **Risk** cell still reads "Medium".
  - **Notes:**

- [ ] `B09A` Sign out, and sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Operations Manager".
  - **Notes:**

- [ ] `4C27` Select the **Lists** page in the left-hand menu.
  - **Expected:** The page is titled **Lists**.
  - **Notes:**

- [ ] `D461` Select **Feature sizes**.
  - **Expected:**
    - The panel opens with **Feature sizes** at the top.
    - Its choices read, from the top, **XS**, **S**, **M**, **L** and **XL**.
    - Under the choices, in grey, a line reads "A feature's rough size, before it is estimated, smallest first."
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-26: Any Column Moves

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account FEAT-25 ended with.

**Preconditions:** Signed in with this account.

- [ ] `E2D8` Select the **Features** page in the left-hand menu.
  - **Expected:** The page is titled **Features**.
  - **Notes:**

- [ ] `2ABD` Open the **Priority** column menu.
  - **Expected:** The menu offers **Move left** and **Move right**.
  - **Notes:**

- [ ] `E29D` Select **Move left**.
  - **Expected:** **Priority** is between **Projects** and **Proposals**.
  - **Notes:**

- [ ] `A80C` Select the **Status** column header, and press Alt+Right arrow (Option+Right arrow on a Mac).
  - **Expected:** **Status** is between **Description** and **Notes**.
  - **Notes:**

- [ ] `B5FA` Drag the **Kind** column header onto the **Customers** column header.
  - **Expected:** **Kind** is between **Notes** and **Customers**.
  - **Notes:**

- [ ] `690E` Reload the page.
  - **Expected:** The table's columns read, from left to right:
    - **Name**
    - **Description**
    - **Status**
    - **Notes**
    - **Kind**
    - **Customers**
    - **Projects**
    - **Priority**
    - **Proposals**
    - **Needed by**
    - **Effort**
    - **Size**
    - **Risk**
    - **Release**
    - **Target cycle**
    - **Feature team**
    - **Staffed**
  - **Notes:**

### FEAT-27: Features Group by Whether Anyone Is on Them

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account FEAT-26 ended with.

**Preconditions:** Run Restore the Seed Data, then select the **Features** page in the left-hand menu.

- [ ] `7E31` Select **Group by** above the table, then **Staffed**.
  - **Expected:**
    - The button reads **Group by: Staffed**.
    - The headings read, from the top, **Yes**, **No** and **Not committed**.
    - 'Offline Sync' is under **Yes**.
    - 'Scheduler API' is under **No**.
  - **Notes:**

- [ ] `B05C` Select **Group by: Staffed**, then **Cycle** under **Group by**.
  - **Expected:** The last heading is **Later**.
  - **Notes:**

### FEAT-28: Features Group by Cycle, Then by Status

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account FEAT-27 ended with.

**Preconditions:** Run Restore the Seed Data, then select the **Features** page in the left-hand menu.

- [ ] `02D2` Select **Group by** above the table, then **Cycle**.
  - **Expected:** The button reads **Group by: Cycle**.
  - **Notes:**

- [ ] `2622` Select **Group by: Cycle**, then **Status** under **Then by**.
  - **Expected:**
    - The button reads **Group by: Cycle, then Status**.
    - Under each cycle's heading, smaller, lighter headings set in from it name feature statuses, such as **In progress**, each with how many features it holds.
  - **Notes:**

- [ ] `60B6` Select **Group by: Cycle, then Status**, then **Clear grouping**.
  - **Expected:**
    - The button reads **Group by**.
    - The rows show as one list, with no headings.
  - **Notes:**

### FEAT-29: A Feature Under Two Projects Shows Under Each

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account FEAT-28 ended with.

**Preconditions:** Run Restore the Seed Data, then select the **Features** page in the left-hand menu.

- [ ] `AC75` Select **Group by** above the table, then **Projects**.
  - **Expected:**
    - The button reads **Group by: Projects**.
    - The headings read, from the top:
      - **Clinic Booking**
      - **P-2001 Crane Control**
      - **P-2017 Depot Operations**
      - **Internal Tools**
      - **P-1984 Transit Displays**
      - **No projects**
    - 'Offline Sync' is under both **Clinic Booking** and **P-2001 Crane Control**.
  - **Notes:**

- [ ] `FCD5` Point at the **+1** after 'Offline Sync' under **Clinic Booking**.
  - **Expected:** A tip reads "Also under P-2001 Crane Control"
  - **Notes:**

- [ ] `8CBA` Select **Group by: Projects**, then **Status** under **Then by**.
  - **Expected:** The button reads **Group by: Projects, then Status**.
  - **Notes:**

- [ ] `B5B3` Point at the **+1** after 'Offline Sync' under **Clinic Booking**.
  - **Expected:**
    - A tip reads "Also under P-2001 Crane Control"
    - The tip names no status.
  - **Notes:**
