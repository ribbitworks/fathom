---
title: "Manual Test: Features"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/features.md"]
last_updated: "2026-11-23"
---

# Manual Test: Features

## Scope

Verifies the Features page: how the table of features looks and reads, its groups by cycle with Later, by release, by the month needed and by project, with a second level of grouping under the first and the +1 after a feature shown under two headings, the Release column, entering a month, customers and a note, the list of feature statuses, editing features as drafts, who may change them, how feature drafts show on the Drafts page, columns added to Features, writing a note in New feature, a feature's effort, shown and typed in the unit chosen, its priority, size and risk, from their built-in lists, and moving any column. The projects and proposals that name a feature are verified in [Feature Links](feature-links-manual-test.md).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`
- **Team Member:** `team.member@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
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

### FEAT-03: A Planned Feature With No Feature Team Is Marked

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-02 ended with.

**Preconditions:** **Features** page open.

- [ ] `F55A` Look at the **Feature team** cell of the row 'Scheduler API'.
  - **Expected:**
    - The cell shows **No team** in red, with no box.
    - No dot is before the box.
    - The box starts in line with the text of the cells above and below.
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

### FEAT-08: Features Follow a Cycle That Changes Length

Covered by [REL-23](release-cycles-manual-test.md#rel-23-a-cycles-new-length-moves-the-cycles-and-releases-after-it) and [REL-24](release-cycles-manual-test.md#rel-24-approving-one-draft-of-a-new-length-approves-them-all) in Release Cycles.

### FEAT-10: Needed By Takes a Month and Shows Its Name

**Account:** Product Manager, `product.manager@fathom.test`, changed from FEAT-07.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

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

- [ ] `3A74` Press Esc.
  - **Expected:** The cell is empty again.
  - **Notes:**

### FEAT-11: Customers and the Note

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-10 ended with.

**Preconditions:** **Features** page open.

- [ ] `53DF` In the row 'Scheduler API', select the **Customers** cell and pick the first two customers offered.
  - **Expected:**
    - The cell shows both customers' names.
    - A hollow yellow dot is before them.
  - **Notes:**

- [ ] `C664` In the row 'Offline Sync', select the **Notes** cell.
  - **Expected:**
    - A side panel titled **Notes** opens beside the table.
    - It shows the note with bold words and a bulleted list, formatted as written.
  - **Notes:**

- [ ] `616D` Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

### FEAT-12: Features Group by the Month They Are Needed

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-11 ended with.

**Preconditions:** **Features** page opened from the left-hand menu, then **Clear view** selected in the **Views** menu above the table, so it is in one list.

- [ ] `BD96` Select **Group by** above the table, then **Needed by**.
  - **Expected:**
    - The button reads **Group by: Needed by**.
    - Each heading names a month and year, such as **Mar 2027**.
    - Each heading has how many features it holds.
    - The headings run from the earliest month to the latest.
    - The last heading is **No date**.
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

**Afterwards:** Run Discard the Unpublished Changes.

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

### FEAT-14: A Feature's Details Open Beside the Table

Covered by [SCOPE-01](scope-history-manual-test.md#scope-01-a-features-customers-and-notes-in-its-details) in Scope History.

### FEAT-15: Those Who Only See the Plan See Added Columns

Covered by [FEAT-07](#feat-07-those-who-only-see-the-plan-cannot-change-features).

### FEAT-16: A Column Is Added to Features as a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account FEAT-13 ended with.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

- [ ] `034F` Select **New column**.
  - **Expected:**
    - The **New column** dialog opens.
    - It has the fields **Name**, **Type**, **List**, **Several choices** and **Must be filled in**.
    - There is no **Offered on planned hires**.
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

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

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

### FEAT-19: Deleting a Column Removes It From Features

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from FEAT-18.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

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

- [ ] `886E` Select **Add** at the foot of the **New feature** panel.
  - **Expected:**
    - The feature is added as a draft.
    - Its details show beside the table.
    - `First words` is in bold under **Notes**.
  - **Notes:**

### FEAT-21: Effort Shows in the Unit Chosen

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-20 ended with.

**Preconditions:** **Features** page open, with no side panel open.

- [ ] `B9CA` Find the **Effort** column, after **Needed by**, and look at the rows 'Audit Export', 'Usage Alerts' and 'Scheduler API'.
  - **Expected:**
    - 'Audit Export' reads "316 h".
    - 'Usage Alerts' reads "424 h".
    - 'Scheduler API' is empty.
  - **Notes:**

- [ ] `2B82` Rest the pointer on "316 h".
  - **Expected:** A tooltip reads "316 hours", and nothing more.
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

### FEAT-22: Effort Is Typed in the Unit Shown and Rounded Up

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-21 ended with.

**Preconditions:** **Features** page open, **Effort** shown in person-days, as FEAT-21 leaves it.

- [ ] `45AB` In the row 'Scheduler API', select the **Effort** cell, type `2.2`, then press Enter.
  - **Expected:**
    - The cell reads "2.5 PD".
    - A hollow yellow dot is before it.
    - A light green Live row under the row shows an empty **Effort**.
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

**Afterwards:** Run Restore the Seed Data.

### FEAT-24: Features Group by Release

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-22 ended with.

**Preconditions:** Restore the Seed Data run after FEAT-22. **Features** page opened from the left-hand menu, in one list.

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

### FEAT-25: Priority, Size and Risk

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-24 ended with. Step `B09A` signs in as another account.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu, then **Clear view** selected in the **Views** menu above the table: in one list, nothing in the search box and no filters.

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

### FEAT-26: Any Column Moves

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account FEAT-25 ended with.

**Preconditions:** Signed in with this account.

- [ ] `E2D8` Select the **Features** page in the left-hand menu.
  - **Expected:** The page is titled **Features**.
  - **Notes:**

- [ ] `B5FA` Drag the **Kind** column header onto the **Customers** column header.
  - **Expected:** **Kind** is between **Notes** and **Customers**.
  - **Notes:**

### FEAT-27: Features Group by Whether Anyone Is on Them

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account FEAT-26 ended with.

**Preconditions:** **Features** page open, in one list, as FEAT-26 leaves it.

- [ ] `7E31` Select **Group by** above the table, then **Staffed**.
  - **Expected:**
    - The button reads **Group by: Staffed**.
    - The headings read, from the top, **Yes**, **No** and **Not committed**.
    - 'Offline Sync' is under **Yes**.
    - 'Scheduler API' is under **No**.
  - **Notes:**

### FEAT-28: Features Group by Cycle, Then by Status

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account FEAT-27 ended with.

**Preconditions:** Select the **Features** page in the left-hand menu, then **Clear view** selected in the **Views** menu above the table.

- [ ] `02D2` Select **Group by** above the table, then **Cycle**.
  - **Expected:** The button reads **Group by: Cycle**.
  - **Notes:**

- [ ] `2622` Select **Group by: Cycle**, then **Status** under **Then by**.
  - **Expected:**
    - The button reads **Group by: Cycle, then Status**.
    - Under each cycle's heading, smaller, lighter headings set in from it name feature statuses, such as **In progress**, each with how many features it holds.
  - **Notes:**

### FEAT-29: A Feature Under Two Projects Shows Under Each

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account FEAT-28 ended with.

**Preconditions:** Select the **Features** page in the left-hand menu, then **Clear view** selected in the **Views** menu above the table.

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
