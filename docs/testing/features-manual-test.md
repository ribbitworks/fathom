---
title: "Manual Test: Features"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-13"
---

# Manual Test: Features

## Scope

Verifies the Features page: how the table of features looks and reads, its groups by cycle with Later, by release and by the month needed, the Release column, entering a month, customers and a note, the list of feature statuses, editing features as drafts, who may change them, how feature drafts show on the Drafts page and when a cycle changes length, columns added to Features, writing a note in New feature, a feature's effort, shown and typed in the unit chosen, and its priority, size and risk, from their built-in lists. The projects and proposals that name a feature are verified in [Feature Links](feature-links-manual-test.md).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`
- **Team Member:** `team.member@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as **Second Engineering Operations Manager**
- **Engineering Director:** `engineering.director@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the left-hand menu, marks, the Group by menu and group headings. This test adds:

- **Group heading on Features:** it names a cycle or **Later**; grouped by release, a release or **Not released yet**; grouped by the month needed, a month or **No date**.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### FEAT-01: The Table Reads Well in Light and Dark

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select the **Features** page in the left-hand menu.
  - **Expected:**
    - The page is titled **Features**.
    - The table's columns read, from left to right:
      - Name
      - Status
      - Description
      - Notes
      - Customers
      - Projects
      - Proposals
      - Priority
      - Needed by
      - Effort
      - Size
      - Risk
      - Release
      - Target cycle
      - Feature team
      - Kind
    - Beside the search box, the count reads **12 features**.
  - **Notes:**

- [ ] **Step 2.** Look down the **Status** column.
  - **Expected:** Each row reads one of **Possible**, **Planned**, **In progress**, **Done** or **Cancelled**.
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu.
  - **Expected:** The page turns dark.
  - **Notes:**

- [ ] **Step 4.** Look at the group headings, the rows, the column headers and the lines between the rows.
  - **Expected:**
    - Every word is easy to read.
    - The group headings are clearly set apart from the rows.
    - Each line between rows, above and below the group headings too, is one thin line running straight across the whole table.
  - **Notes:**

- [ ] **Step 5.** Choose **Light** in the Appearance menu.
  - **Expected:** The page is light.
  - **Notes:**

- [ ] **Step 6.** Look at the group headings, the rows, the column headers and the lines between the rows.
  - **Expected:**
    - Every word is easy to read.
    - The group headings are clearly set apart from the rows.
    - Each line between rows, above and below the group headings too, is one thin line running straight across the whole table.
  - **Notes:**

### FEAT-02: Features Are Grouped by Cycle, With Later Last

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-01 ended with.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** Read the group headings from top to bottom.
  - **Expected:**
    - Each heading names the stream and the cycle, such as **Platform: 27.1**.
    - Each heading has how many features it holds.
    - The headings run from the earliest cycle to the latest.
    - The last heading is **Later**.
  - **Notes:**

- [ ] **Step 2.** Look under the heading **Later**.
  - **Expected:**
    - The rows **Voice Notes**, **Partner Portal** and **Shift Handover Notes** are there.
    - Each has **Target cycle** empty.
  - **Notes:**

- [ ] **Step 3.** Type `offline` in the search box.
  - **Expected:**
    - Only the row **Offline Sync** shows.
    - It is under its cycle's heading.
    - No heading without a row shows.
  - **Notes:**

- [ ] **Step 4.** Empty the search box.
  - **Expected:**
    - Each heading names the stream and the cycle, such as **Platform: 27.1**.
    - Each heading has how many features it holds.
    - The headings run from the earliest cycle to the latest.
    - The last heading is **Later**.
    - All 12 rows show.
  - **Notes:**

- [ ] **Step 5.** Select **Group by: Cycle** above the table, then **None**.
  - **Expected:**
    - The headings are gone.
    - The 12 rows show as one list.
  - **Notes:**

- [ ] **Step 6.** Reload the page.
  - **Expected:** The rows still show as one list.
  - **Notes:**

- [ ] **Step 7.** Select **Group by: None**, then **Cycle**.
  - **Expected:**
    - Each heading names the stream and the cycle, such as **Platform: 27.1**.
    - Each heading has how many features it holds.
    - The headings run from the earliest cycle to the latest.
    - The last heading is **Later**.
  - **Notes:**

### FEAT-03: A Planned Feature With No Feature Team Is Marked

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-02 ended with.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** Look at the **Feature team** cell of the row **Scheduler API**.
  - **Expected:**
    - The cell has a red **No team** box.
    - No dot is before the box.
    - The box starts in line with the text of the cells above and below.
  - **Notes:**

- [ ] **Step 2.** Look at the **Feature team** cell of the row **Partner Portal**.
  - **Expected:**
    - The cell is empty.
    - The cell has no box.
  - **Notes:**

### FEAT-04: Adding and Changing Features Makes Drafts

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-03 ended with.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** Look at the empty row at the end of the table.
  - **Expected:** Every cell of the empty row is blank.
  - **Notes:**

- [ ] **Step 2.** In the empty row at the end of the table, type `Fictional Reports` in **Name**, then press Enter.
  - **Expected:**
    - A hollow yellow dot is in the row's slot.
    - The row is tinted faint yellow.
    - **Status** reads **Possible**.
    - The row stays where it is until the view next changes.
  - **Notes:**

- [ ] **Step 3.** Reload the page.
  - **Expected:**
    - **Fictional Reports** is under the heading **Later**.
    - The hollow yellow dot is in its slot.
  - **Notes:**

- [ ] **Step 4.** In the row **Report Builder**, select the **Target cycle** cell.
  - **Expected:**
    - A list of cycles opens.
    - Each choice names its stream and cycle.
  - **Notes:**

- [ ] **Step 5.** Choose another cycle from the list.
  - **Expected:**
    - The new cycle has a hollow yellow dot before it.
    - A light green Live row under the row shows the old cycle.
    - A green dot is before the old cycle.
    - The row keeps its place until the view next changes.
  - **Notes:**

- [ ] **Step 6.** Select **Publish** in the top bar.
  - **Expected:** The hollow dots on both rows are now solid yellow.
  - **Notes:**

### FEAT-05: An Approver Approves a Feature's Draft

**Account:** Project Manager, `project.manager@fathom.test`, changed from FEAT-04.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select the **⋯** menu of the row **Report Builder**.
  - **Expected:**
    - The menu names the feature and the change to **Target cycle**.
    - It offers **Approve…** and **Reject…**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve…**.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] **Step 3.** Select **Approve**.
  - **Expected:**
    - The row has no dot.
    - The row has no Live row under it.
    - It shows under the heading of its new cycle.
  - **Notes:**

### FEAT-06: Feature Drafts Show on the Drafts Page

**Account:** Project Manager, `project.manager@fathom.test`, the account FEAT-05 ended with.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The list has an entry reading **Product Manager as Product Manager drafted adding the feature Fictional Reports**.
  - **Notes:**

### FEAT-07: Those Who Only See the Plan Cannot Change Features

**Account:** Team Member, `team.member@fathom.test`, changed from FEAT-06.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select the **Features** page in the left-hand menu.
  - **Expected:**
    - The table shows.
    - There is no **New feature** button.
    - There is no empty row at the table's end.
  - **Notes:**

- [ ] **Step 2.** Double-click the **Status** cell of any row.
  - **Expected:** The cell does not open for editing.
  - **Notes:**

### FEAT-08: Features Follow a Cycle That Changes Length

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from FEAT-07. Step 8 signs in as another account.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account.

- [ ] **Step 1.** Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 2.** Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The streams table shows **Platform**.
    - **Platform** has no grey lock in its slot.
  - **Notes:**

- [ ] **Step 3.** Select **Platform** in the table.
  - **Expected:** The side panel opens, headed **Platform**.
  - **Notes:**

- [ ] **Step 4.** In the side panel's **Cycles** table, find the row whose dates include today. Select the **⋯** button at the end of the row directly below it, then **Change length…**.
  - **Expected:** A dialog titled **Change the length of** that cycle opens.
  - **Notes:**

- [ ] **Step 5.** Replace **3** in **Length** with `2`.
  - **Expected:** Below **New dates**:
    - **Releases that move** names **Harbor 3** and **Harbor 4**.
    - **Features that move** names **Data Retention Controls** and **Report Builder**.
  - **Notes:**

- [ ] **Step 6.** Select **Change length**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] **Step 7.** Select **Publish** in the top bar.
  - **Expected:** The **Publish** button is gone from the top bar.
  - **Notes:**

- [ ] **Step 8.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] **Step 9.** Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - The list has entries naming **the feature Data Retention Controls** and **the feature Report Builder**.
    - It has entries for **the cycles of Platform**.
  - **Notes:**

- [ ] **Step 10.** Tick one entry for **the cycles of Platform**.
  - **Expected:** The entry's checkbox is ticked.
  - **Notes:**

- [ ] **Step 11.** Select **Reject…**.
  - **Expected:** The dialog lists **the feature Data Retention Controls** and **the feature Report Builder** among the drafts it includes.
  - **Notes:**

- [ ] **Step 12.** Type a reason in the dialog.
  - **Expected:** The dialog holds the reason typed.
  - **Notes:**

- [ ] **Step 13.** Select **Reject** in the dialog.
  - **Expected:** The entries for **the cycles of Platform**, **the feature Data Retention Controls** and **the feature Report Builder** each start with a red dot in a ring.
  - **Notes:**

### FEAT-09: The Keyboard Moves Across Group Headings

**Account:** Product Manager, `product.manager@fathom.test`, changed from FEAT-08.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select the **Name** cell of the last row under a group heading.
  - **Expected:** The cell is selected.
  - **Notes:**

- [ ] **Step 2.** Press the Down arrow.
  - **Expected:**
    - The selection moves to the **Name** cell of the first row under the next heading.
    - The selection does not stop on the heading.
  - **Notes:**

### FEAT-10: Needed By Takes a Month and Shows Its Name

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-09 ended with.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** In the row **Usage Alerts**, select the **Needed by** cell.
  - **Expected:** The cell is selected.
  - **Notes:**

- [ ] **Step 2.** Type `203003`.
  - **Expected:** The cell reads **2030-03**.
  - **Notes:**

- [ ] **Step 3.** Press Enter.
  - **Expected:**
    - The cell reads **Mar 2030**.
    - A hollow yellow dot is before it.
    - A light green Live row under the row shows an empty **Needed by**.
  - **Notes:**

- [ ] **Step 4.** In the row **Scheduler API**, select the **Needed by** cell, type `203013`, then press Enter.
  - **Expected:**
    - The value is refused.
    - The message reads **Needed by: use a month such as 2027-03**.
  - **Notes:**

- [ ] **Step 5.** Press Escape.
  - **Expected:** The cell is empty again.
  - **Notes:**

### FEAT-11: Customers, the Description and the Note

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-10 ended with.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** In the row **Scheduler API**, select the **Customers** cell and pick the first two customers offered.
  - **Expected:**
    - The cell shows both customers' names.
    - A hollow yellow dot is before them.
  - **Notes:**

- [ ] **Step 2.** In the row **Scheduler API**, select the **Description** cell, replace its text with 201 letters, then press Enter.
  - **Expected:**
    - The value is refused.
    - The message reads **Description too long**.
  - **Notes:**

- [ ] **Step 3.** Press Escape.
  - **Expected:** The description is back as it was.
  - **Notes:**

- [ ] **Step 4.** In the row **Offline Sync**, select the **Notes** cell.
  - **Expected:**
    - A side panel titled **Notes** opens beside the table.
    - It shows the note with bold words and a bulleted list, formatted as written.
  - **Notes:**

- [ ] **Step 5.** Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] **Step 6.** Look at the **Notes** cell of the row **Offline Sync**.
  - **Expected:** The cell shows the start of the note as plain words.
  - **Notes:**

### FEAT-12: Features Group by the Month They Are Needed

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-11 ended with.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select **Group by: Cycle** above the table, then **Needed by**.
  - **Expected:**
    - The button reads **Group by: Needed by**.
    - Each heading names a month and year, such as **Mar 2027**.
    - Each heading has how many features it holds.
    - The headings run from the earliest month to the latest.
    - The last heading is **No date**.
  - **Notes:**

- [ ] **Step 2.** Reload the page.
  - **Expected:** The headings are still by month.
  - **Notes:**

- [ ] **Step 3.** Select **Group by: Needed by**, then **None**.
  - **Expected:**
    - The headings are gone.
    - The rows show as one list.
    - The button reads **Group by: None**.
  - **Notes:**

- [ ] **Step 4.** Select **Group by: None**, then **Cycle**.
  - **Expected:**
    - The headings name cycles again.
    - The last heading is **Later**.
  - **Notes:**

### FEAT-13: Feature Statuses Are a List With Meanings

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FEAT-12.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select the **Lists** page in the left-hand menu.
  - **Expected:**
    - The **Lists** page opens.
    - **Feature statuses** is in its table.
  - **Notes:**

- [ ] **Step 2.** Select **Feature statuses** in the table.
  - **Expected:**
    - The list's name has a grey **Built in** box after it.
    - Its choices are, in order, **Possible**, **Planned**, **In progress**, **Done** and **Cancelled**.
    - Each choice is beside a meaning of the same name.
  - **Notes:**

- [ ] **Step 3.** Read the lines under the choices.
  - **Expected:**
    - They invite renaming, adding and retiring.
    - They say what each of the five meanings is.
    - The lines end with **Keep at least one choice for each.**
  - **Notes:**

- [ ] **Step 4.** In the empty row of the choices, type `Long shot`.
  - **Expected:** The empty row holds **Long shot**.
  - **Notes:**

- [ ] **Step 5.** Choose the meaning **Possible** in the same row.
  - **Expected:** The row's meaning reads **Possible**.
  - **Notes:**

- [ ] **Step 6.** Press Enter.
  - **Expected:**
    - **Long shot** is added.
    - A hollow yellow dot is before it.
    - Its meaning is **Possible**.
  - **Notes:**

### FEAT-14: A Feature's Details Open Beside the Table

Covered by [SCOPE-01](scope-history-manual-test.md#scope-01-a-features-customers-and-notes-in-its-details) in Scope History.

### FEAT-15: Those Who Only See the Plan See Added Columns

**Account:** Team Member, `team.member@fathom.test`, changed from FEAT-13.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account.

- [ ] **Step 1.** Select the **Features** page in the left-hand menu.
  - **Expected:** The page is titled **Features**.
  - **Notes:**

- [ ] **Step 2.** Scroll right to the **Kind** column.
  - **Expected:**
    - There is no **New column** button.
    - The row **Offline Sync** shows **New**.
    - **Mobile Approvals** shows **Improvement**.
    - **Data Retention Controls** shows **Fix**.
    - **Report Builder** shows **New**.
    - **Usage Alerts** is empty.
  - **Notes:**

- [ ] **Step 3.** Open the **Kind** column menu.
  - **Expected:**
    - The menu offers sorting and filtering.
    - It has no **Edit column**, **Move left** or **Move right**.
  - **Notes:**

### FEAT-16: A Column Is Added to Features as a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FEAT-15.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select **New column**.
  - **Expected:**
    - The **New column** dialog opens.
    - It has the fields **Name**, **Type**, **List**, **Several choices** and **Must be filled in**.
    - There is no **Offered on planned hires**.
  - **Notes:**

- [ ] **Step 2.** Open the **List** box.
  - **Expected:**
    - **Kind** is offered.
    - No list marked **Personal** or **Confidential** is offered.
  - **Notes:**

- [ ] **Step 3.** Set **Type** to **Number**.
  - **Expected:**
    - The **List** box and **Several choices** go.
    - No box asking who may see the values appears.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional Score` in **Name**.
  - **Expected:** **Name** holds **Fictional Score**.
  - **Notes:**

- [ ] **Step 5.** Select **Add column**.
  - **Expected:**
    - The dialog closes.
    - A **Fictional Score** column is added at the right end of the table.
    - The column is tinted faint yellow.
    - A hollow yellow dot is before **Fictional Score** in its header.
  - **Notes:**

- [ ] **Step 6.** Double-click the **Fictional Score** cell of any row.
  - **Expected:** The cell does not open for editing while the column is a draft.
  - **Notes:**

- [ ] **Step 7.** Open the **Fictional Score** column menu.
  - **Expected:**
    - The menu offers **Edit column**.
    - It has no **Move left** or **Move right**.
  - **Notes:**

- [ ] **Step 8.** Select **Edit column**.
  - **Expected:**
    - The **Edit column** dialog opens.
    - **Type** is greyed out.
    - There is no **Delete column** button.
  - **Notes:**

- [ ] **Step 9.** Select **Cancel**.
  - **Expected:**
    - The dialog closes.
    - Nothing has changed.
  - **Notes:**

- [ ] **Step 10.** Select **Publish** in the top bar.
  - **Expected:** The dot before **Fictional Score** is now solid yellow.
  - **Notes:**

### FEAT-17: An Approver Approves a Column on Features

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from FEAT-16.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - The list has an entry naming **the column Fictional Score on Features**.
    - The entry is drafted by **Engineering Operations Manager**.
  - **Notes:**

- [ ] **Step 2.** Select the **Features** page in the left-hand menu.
  - **Expected:** The page is titled **Features**.
  - **Notes:**

- [ ] **Step 3.** Open the **Fictional Score** column menu.
  - **Expected:** The menu offers **Approve…** and **Reject…**.
  - **Notes:**

- [ ] **Step 4.** Select **Approve…**.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] **Step 5.** Select **Approve**.
  - **Expected:**
    - The **Fictional Score** header has no dot.
    - The column is no longer tinted.
    - **Fictional Score** stays at the right end of the table, after **Kind**.
  - **Notes:**

### FEAT-18: A Value in an Added Column Is Part of a Feature's Draft

**Account:** Product Manager, `product.manager@fathom.test`, changed from FEAT-17.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Double-click the **Fictional Score** cell of the row **Usage Alerts**, type `3.5` and press Enter.
  - **Expected:**
    - The cell shows **3.5**.
    - A hollow yellow dot is before it.
    - A light green Live row under the row has an empty **Fictional Score** cell.
  - **Notes:**

- [ ] **Step 2.** Double-click the **Kind** cell of the same row, and choose **Fix**.
  - **Expected:**
    - The cell shows **Fix**.
    - The Live row's **Kind** cell stays empty.
  - **Notes:**

- [ ] **Step 3.** Select the **Drafts** page in the left-hand menu, and find **the feature Usage Alerts**.
  - **Expected:** Its entry names both changes:
    - **Fictional Score** to **3.5**.
    - **Kind** to **Fix**.
  - **Notes:**

- [ ] **Step 4.** Select the **Features** page in the left-hand menu.
  - **Expected:** The page is titled **Features**.
  - **Notes:**

- [ ] **Step 5.** Point at the row **Usage Alerts**, and select the details button at the right of its **Name** cell.
  - **Expected:**
    - The side panel lists **Fictional Score** and **Kind**.
    - Each shows the drafted value, with the live value under it.
  - **Notes:**

- [ ] **Step 6.** Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] **Step 7.** Select **Publish** in the top bar.
  - **Expected:** The dots before **3.5** and **Fix** on the row **Usage Alerts** are now solid yellow.
  - **Notes:**

- [ ] **Step 8.** Select **New feature**.
  - **Expected:** The form offers **Kind** and **Fictional Score**.
  - **Notes:**

- [ ] **Step 9.** Select **Cancel**.
  - **Expected:** The form closes.
  - **Notes:**

- [ ] **Step 10.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] **Step 11.** Select the **Features** page in the left-hand menu.
  - **Expected:** The page is titled **Features**.
  - **Notes:**

- [ ] **Step 12.** Open the **⋯** menu of the row **Usage Alerts**, and select **Approve…**.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] **Step 13.** Select **Approve**.
  - **Expected:**
    - The row has no dot.
    - The row has no Live row under it.
    - It still shows **3.5** and **Fix**.
  - **Notes:**

### FEAT-19: Deleting a Column Removes It From Features

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from FEAT-18.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Open the **Fictional Score** column menu and select **Edit column**.
  - **Expected:**
    - The **Edit column** dialog opens.
    - It has a red **Delete column** button.
  - **Notes:**

- [ ] **Step 2.** Select **Delete column**.
  - **Expected:**
    - The dialog closes.
    - A notice reads **Deleted the Fictional Score column.**
    - The column stays in the table.
    - A hollow yellow dot is before its name.
    - The column's name is struck through.
  - **Notes:**

- [ ] **Step 3.** Select **Publish** in the top bar.
  - **Expected:** The dot before **Fictional Score** is now solid yellow.
  - **Notes:**

- [ ] **Step 4.** Open the **Fictional Score** column menu, and select **Approve…**.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] **Step 5.** Select **Approve**.
  - **Expected:**
    - The **Fictional Score** column is gone.
    - The table ends with **Kind**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-20: New Feature Writes a Note in Its Own Panel

**Account:** Product Manager, `product.manager@fathom.test`, changed from FEAT-19.

**Preconditions:** Restore the Seed Data run after FEAT-19. Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select **New feature**.
  - **Expected:**
    - The **New feature** panel opens beside the table.
    - Each label is at the left of its row.
    - The rows are under the headings **Details** and **Columns**.
    - The **Notes** row has **None** as its value.
    - It has a pencil button at its right.
    - There is no text box for the note.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional Atlas` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 3.** Select the pencil button in the **Notes** row.
  - **Expected:**
    - A second panel opens under **New feature**, titled **Notes for New feature**.
    - **Note**, **Editor** and **Markdown** are at its top.
    - **Editor** is chosen.
    - A toolbar is under the text.
    - **Fictional Atlas** is still in **Name**.
  - **Notes:**

- [ ] **Step 4.** Choose **Dark** in the Appearance menu.
  - **Expected:** Both panels are easy to read.
  - **Notes:**

- [ ] **Step 5.** Choose **Light** in the Appearance menu.
  - **Expected:** Both panels are easy to read.
  - **Notes:**

- [ ] **Step 6.** Type `First words` in the editor.
  - **Expected:** The editor holds **First words**.
  - **Notes:**

- [ ] **Step 7.** Select the words **First words** in the editor.
  - **Expected:** The words are highlighted.
  - **Notes:**

- [ ] **Step 8.** Select **Bold** in the toolbar.
  - **Expected:** **First words** is bold in the editor.
  - **Notes:**

- [ ] **Step 9.** In the **New feature** panel, change **Name** to `Fictional Atlas Two`.
  - **Expected:**
    - **Name** shows what was typed.
    - The note's panel stays open.
  - **Notes:**

- [ ] **Step 10.** Select **Save** in the note's panel.
  - **Expected:**
    - The note's panel closes.
    - The **Notes** row shows **First words** in bold.
    - **Name** still reads **Fictional Atlas Two**.
  - **Notes:**

- [ ] **Step 11.** Select the pencil button in the **Notes** row.
  - **Expected:**
    - The note's panel opens.
    - It shows the note as it reads.
  - **Notes:**

- [ ] **Step 12.** Select **Editor**.
  - **Expected:** The editor shows **First words**.
  - **Notes:**

- [ ] **Step 13.** Type more words in the editor.
  - **Expected:** The words appear in the editor.
  - **Notes:**

- [ ] **Step 14.** Select **Cancel** in the **New feature** panel.
  - **Expected:**
    - A box asks **Discard the new feature?**
    - It offers **Keep adding** and **Discard**.
  - **Notes:**

- [ ] **Step 15.** Select **Keep adding**.
  - **Expected:**
    - The box closes.
    - Both panels stay open.
  - **Notes:**

- [ ] **Step 16.** Select **Cancel** in the note's panel.
  - **Expected:**
    - The note's panel closes.
    - The **Notes** row still shows only **First words**.
  - **Notes:**

- [ ] **Step 17.** Select **Add** at the foot of the **New feature** panel.
  - **Expected:**
    - The feature is added as a draft.
    - Its details show beside the table.
    - **First words** is in bold under **Notes**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-21: Effort Shows in the Unit Chosen

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-20 ended with.

**Preconditions:** Restore the Seed Data run after FEAT-20. **Features** page open.

- [ ] **Step 1.** Find the **Effort** column, after **Needed by**, and look at the rows **Audit Export**, **Usage Alerts** and **Scheduler API**.
  - **Expected:**
    - **Audit Export** reads **316 h**.
    - **Usage Alerts** reads **424 h**.
    - **Scheduler API** is empty.
  - **Notes:**

- [ ] **Step 2.** Rest the pointer on **316 h**.
  - **Expected:** A tooltip reads **316 hours**, and nothing more.
  - **Notes:**

- [ ] **Step 3.** Select the **Release** cell of **Audit Export**.
  - **Expected:** The cell is selected.
  - **Notes:**

- [ ] **Step 4.** Press the Right arrow key once.
  - **Expected:**
    - The **Effort** cell of **Audit Export** is selected.
    - A tooltip beside it reads **316 hours**.
  - **Notes:**

- [ ] **Step 5.** Open the column menu of **Effort**.
  - **Expected:**
    - Under **Show in**, the menu lists **Hours**, **Person-days**, **Person-weeks**, **Person-months** and **Person-quarters**, in that order.
    - A tick is beside **Hours** only.
    - Under **Decimal places**, it lists **0**, **1** and **2**.
    - A tick is beside **2** only.
    - It has no **Break down by**.
  - **Notes:**

- [ ] **Step 6.** Select **Person-days**.
  - **Expected:**
    - The menu closes.
    - **Audit Export** reads **39.5 PD**.
    - **Usage Alerts** reads **53 PD**.
  - **Notes:**

- [ ] **Step 7.** Rest the pointer on **39.5 PD**.
  - **Expected:** A tooltip reads **316 hours**.
  - **Notes:**

- [ ] **Step 8.** Open the column menu of **Effort**, and select **Person-weeks**.
  - **Expected:**
    - **Audit Export** reads **8 PW**.
    - **Usage Alerts** reads **10.6 PW**.
  - **Notes:**

- [ ] **Step 9.** Rest the pointer on **8 PW**.
  - **Expected:** A tooltip reads **316 hours, rounded up**.
  - **Notes:**

- [ ] **Step 10.** Open the column menu of **Effort**, and select **Person-months**.
  - **Expected:**
    - **Audit Export** reads **2 PM**.
    - **Usage Alerts** reads **2.65 PM**.
    - **Bulk Import** reads **1.5 PM**.
  - **Notes:**

- [ ] **Step 11.** Open the column menu of **Effort**, and select **Person-quarters**.
  - **Expected:**
    - **Audit Export** reads **0.67 PQ**.
    - **Usage Alerts** reads **0.89 PQ**.
    - **Bulk Import** reads **0.5 PQ**.
  - **Notes:**

- [ ] **Step 12.** Open the column menu of **Effort**, and select **Person-months**.
  - **Expected:** **Usage Alerts** reads **2.65 PM**.
  - **Notes:**

- [ ] **Step 13.** Open the column menu of **Effort**, and select **1** under **Decimal places**.
  - **Expected:**
    - **Audit Export** reads **2 PM**.
    - **Usage Alerts** reads **2.7 PM**.
    - **Bulk Import** reads **1.5 PM**.
  - **Notes:**

- [ ] **Step 14.** Rest the pointer on **2.7 PM**.
  - **Expected:** A tooltip reads **424 hours, rounded up**.
  - **Notes:**

- [ ] **Step 15.** Open the column menu of **Effort**, and select **0** under **Decimal places**.
  - **Expected:**
    - **Usage Alerts** reads **3 PM**.
    - **Bulk Import** reads **2 PM**.
  - **Notes:**

- [ ] **Step 16.** Reload the page.
  - **Expected:** **Effort** still shows person-months with no decimal places: **Usage Alerts** reads **3 PM**.
  - **Notes:**

- [ ] **Step 17.** Open the **Views** menu.
  - **Expected:** It lists **Units: Effort in person-months to 0 decimal places**.
  - **Notes:**

- [ ] **Step 18.** Press Escape.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 19.** Choose **Dark** in the Appearance menu.
  - **Expected:** The page turns dark.
  - **Notes:**

- [ ] **Step 20.** Rest the pointer on **3 PM**.
  - **Expected:** The tooltip is easy to read.
  - **Notes:**

- [ ] **Step 21.** Open the column menu of **Effort**.
  - **Expected:** The column menu is easy to read.
  - **Notes:**

- [ ] **Step 22.** Press Escape.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 23.** Choose **Light** in the Appearance menu.
  - **Expected:** The page is light.
  - **Notes:**

- [ ] **Step 24.** Open the **Views** menu, and select **Units: Effort in person-months to 0 decimal places**.
  - **Expected:** **Audit Export** reads **316 h** again.
  - **Notes:**

### FEAT-22: Effort Is Typed in the Unit Shown and Rounded Up

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-21 ended with.

**Preconditions:** **Features** page open, **Effort** shown in hours to 2 decimal places, as the column menu of **Effort** shows with ticks beside **Hours** and **2**.

- [ ] **Step 1.** Open the column menu of **Effort**, and select **Person-days**.
  - **Expected:** **Audit Export** reads **39.5 PD**.
  - **Notes:**

- [ ] **Step 2.** In the row **Scheduler API**, select the **Effort** cell, type `2.2`, then press Enter.
  - **Expected:**
    - The cell reads **2.5 PD**.
    - A hollow yellow dot is before it.
    - A light green Live row under the row shows an empty **Effort**.
  - **Notes:**

- [ ] **Step 3.** Select the **Effort** cell of **Scheduler API** reading **2.5 PD**, above the Live row, and press Enter.
  - **Expected:**
    - A field opens in the cell holding **2.5**.
    - **PD** is after it.
  - **Notes:**

- [ ] **Step 4.** Press Enter without changing the field.
  - **Expected:**
    - The field closes.
    - The cell still reads **2.5 PD**.
  - **Notes:**

- [ ] **Step 5.** Select the **Effort** cell of **Scheduler API** reading **2.5 PD** again, type `-1`, then press Enter.
  - **Expected:**
    - The value is refused.
    - The message reads **Effort: use 0 or more**.
  - **Notes:**

- [ ] **Step 6.** Press Escape.
  - **Expected:** The cell reads **2.5 PD** again.
  - **Notes:**

- [ ] **Step 7.** Select **Show details** in the **⋯** menu of **Scheduler API**.
  - **Expected:**
    - The details panel opens beside the table.
    - Its **Effort** row reads **2.5 person-days (20 hours)**.
  - **Notes:**

- [ ] **Step 8.** Select the pencil button in the **Effort** row.
  - **Expected:**
    - A field opens holding **2.5**.
    - A menu beside it reads **person-days**.
  - **Notes:**

- [ ] **Step 9.** Press Tab twice, past the field's **×**.
  - **Expected:**
    - The menu beside the field has focus.
    - The field stays open.
  - **Notes:**

- [ ] **Step 10.** Press Escape.
  - **Expected:**
    - The field closes.
    - The **Effort** row still reads **2.5 person-days (20 hours)**.
  - **Notes:**

- [ ] **Step 11.** Select the pencil button in the **Effort** row.
  - **Expected:**
    - A field opens holding **2.5**.
    - A menu beside it reads **person-days**.
  - **Notes:**

- [ ] **Step 12.** Select **hours** in the menu beside the field.
  - **Expected:**
    - The field now holds **20**.
    - The menu reads **hours**.
  - **Notes:**

- [ ] **Step 13.** Change the field to `28`, then press Enter.
  - **Expected:**
    - The **Effort** row reads **3.5 person-days (28 hours)**.
    - In the table **Scheduler API** reads **3.5 PD**.
  - **Notes:**

- [ ] **Step 14.** Select the pencil button in the **Effort** row.
  - **Expected:**
    - A field opens holding **3.5**.
    - A menu beside it reads **person-days**.
  - **Notes:**

- [ ] **Step 15.** Press Tab twice.
  - **Expected:** The menu beside the field has focus.
  - **Notes:**

- [ ] **Step 16.** Using only the keyboard, choose **person-weeks** in the menu.
  - **Expected:**
    - The menu reads **person-weeks**.
    - The field holds **0.8**.
  - **Notes:**

- [ ] **Step 17.** Press Shift+Tab twice.
  - **Expected:** The field has focus.
  - **Notes:**

- [ ] **Step 18.** Type `1` in place of what the field holds.
  - **Expected:** The field holds **1**.
  - **Notes:**

- [ ] **Step 19.** Press Tab three times, until neither the field nor the menu has focus.
  - **Expected:**
    - The field closes.
    - The **Effort** row reads **5 person-days (40 hours)**.
  - **Notes:**

- [ ] **Step 20.** Close the details panel.
  - **Expected:**
    - The panel closes.
    - **Scheduler API** reads **5 PD**.
  - **Notes:**

- [ ] **Step 21.** Open the column menu of **Effort**.
  - **Expected:** It ticks **Person-days**.
  - **Notes:**

- [ ] **Step 22.** Select **Hours**.
  - **Expected:** **Scheduler API** reads **40 h**.
  - **Notes:**

- [ ] **Step 23.** Select **Show details** in the **⋯** menu of **Scheduler API**.
  - **Expected:** The panel's **Effort** row reads **40 hours**, with nothing after it.
  - **Notes:**

- [ ] **Step 24.** Close the details panel.
  - **Expected:** The panel closes.
  - **Notes:**

- [ ] **Step 25.** Select the **Drafts** page in the left-hand menu, and find the draft of **Scheduler API**.
  - **Expected:** Its details read **Effort** set to **40 hours**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-23: New Feature Takes Effort in a Unit Chosen

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-22 ended with.

**Preconditions:** Restore the Seed Data run after FEAT-22. **Features** page open.

- [ ] **Step 1.** Open the column menu of **Effort**, and select **Person-weeks**.
  - **Expected:** **Audit Export** reads **8 PW**.
  - **Notes:**

- [ ] **Step 2.** Select **New feature**.
  - **Expected:**
    - The **New feature** panel opens.
    - Its **Effort** row has an empty field.
    - A menu beside it reads **person-weeks**.
  - **Notes:**

- [ ] **Step 3.** Type `Fictional Effort` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 4.** Type `2` in **Effort**.
  - **Expected:** **Effort** shows **2**.
  - **Notes:**

- [ ] **Step 5.** Open the menu beside **Effort**.
  - **Expected:** It lists **hours**, **person-days**, **person-weeks**, **person-months** and **person-quarters**.
  - **Notes:**

- [ ] **Step 6.** Select **person-days**.
  - **Expected:**
    - The menu reads **person-days**.
    - **Effort** still holds **2**.
    - The table's **Effort** column still shows person-weeks.
  - **Notes:**

- [ ] **Step 7.** Select **Add** at the foot of the **New feature** panel.
  - **Expected:**
    - The feature is added as a draft.
    - Its details show beside the table.
    - The **Effort** row reads **0.4 person-weeks (16 hours)**.
    - In the table, **Fictional Effort** reads **0.4 PW**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-24: Features Group by Release

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-23 ended with.

**Preconditions:** Restore the Seed Data run after FEAT-23. **Features** page open.

- [ ] **Step 1.** Select **Group by: Cycle** above the table.
  - **Expected:**
    - The menu offers **Cycle**, **Release**, **Needed by** and **None**.
    - A tick is beside **Cycle**.
  - **Notes:**

- [ ] **Step 2.** Select **Release**.
  - **Expected:**
    - The button reads **Group by: Release**.
    - The headings are, from top to bottom, **Platform: Harbor 1**, **Platform: Harbor 2 LTS**, **Platform: Harbor 3**, **Platform: Not released yet** and **Later**.
    - Each of the three **Harbor** headings is followed by a comma, **ships** and a date with its day, month and year, such as **ships 31 Mar 2027**.
    - The counts beside the headings read **1**, **4**, **2**, **2** and **3**.
    - No heading names **Harbor 4** or a **Patches** release.
  - **Notes:**

- [ ] **Step 3.** Select the **Releases** page in the left-hand menu.
  - **Expected:** The streams table shows **Platform**.
  - **Notes:**

- [ ] **Step 4.** Select **Platform** in the table.
  - **Expected:**
    - A side panel for **Platform** opens.
    - Under **Releases**, each **Harbor** row ends with **ships** and a day, such as **26.3 to 26.4 · ships 2026-12-31**.
    - The rows naming **Harbor 1**, **Harbor 2 LTS** and **Harbor 3**, not their Live rows, each ship on the day their heading on the Features page shows, written year first, such as **ships 2027-03-31** for **ships 31 Mar 2027**.
  - **Notes:**

- [ ] **Step 5.** Select the **Features** page in the left-hand menu.
  - **Expected:** The button above the table reads **Group by: Cycle**.
  - **Notes:**

- [ ] **Step 6.** Select **Group by: Cycle** above the table, then **Release**.
  - **Expected:**
    - The headings are, from top to bottom, **Platform: Harbor 1**, **Platform: Harbor 2 LTS**, **Platform: Harbor 3**, **Platform: Not released yet** and **Later**.
    - Each of the three **Harbor** headings is followed by a comma, **ships** and a date with its day, month and year, such as **ships 31 Mar 2027**.
    - The counts beside the headings read **1**, **4**, **2**, **2** and **3**.
  - **Notes:**

- [ ] **Step 7.** In the row **Report Builder**, under **Platform: Harbor 3**, select the **Target cycle** cell and choose the cycle two after the one it shows.
  - **Expected:**
    - The new cycle has a hollow yellow dot before it.
    - A light green Live row under the row shows the old cycle.
    - The row stays under **Platform: Harbor 3** until the view next changes.
  - **Notes:**

- [ ] **Step 8.** Reload the page.
  - **Expected:**
    - **Platform: Not released yet** now counts **3**.
    - **Platform: Harbor 3** now counts **1**.
    - **Report Builder** is under **Platform: Not released yet**.
    - **Report Builder**'s Live row under it shows the old cycle.
  - **Notes:**

- [ ] **Step 9.** Select **Group by: Release**, then **None**.
  - **Expected:**
    - The headings are gone.
    - The rows show as one list.
    - The button reads **Group by: None**.
  - **Notes:**

- [ ] **Step 10.** Select **Group by: None**, then **Cycle**.
  - **Expected:**
    - The headings name cycles again.
    - The last heading is **Later**.
  - **Notes:**

- [ ] **Step 11.** Find the **Release** column, before **Target cycle**, and look at the rows **Report Builder**, **Offline Sync** and **Voice Notes**.
  - **Expected:**
    - In **Report Builder**'s row, **Release** reads **Platform: Not released yet**.
    - In its Live row, **Release** reads **Platform: Harbor 3**.
    - **Offline Sync** reads **Platform: Harbor 2 LTS**, with no date.
    - **Voice Notes**' **Release** is empty.
  - **Notes:**

- [ ] **Step 12.** Select the small button with an arrow out of a box at the right of **Report Builder**'s **Name** cell.
  - **Expected:**
    - The side panel lists **Release** before **Target cycle**.
    - **Release** reads **Platform: Not released yet**.
    - It is underlined as a link.
  - **Notes:**

- [ ] **Step 13.** Select **Platform: Not released yet** in the side panel.
  - **Expected:**
    - The **Releases** page opens.
    - The **Platform** side panel is open beside its table.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-25: Priority, Size and Risk

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-24 ended with. Step 9 signs in as another account.

**Preconditions:** Restore the Seed Data run after FEAT-24. **Features** page open.

- [ ] **Step 1.** Read the **Priority**, **Size** and **Risk** cells of **Offline Sync**.
  - **Expected:**
    - **Priority** reads **Critical**.
    - **Size** reads **L**.
    - **Risk** reads **High**.
  - **Notes:**

- [ ] **Step 2.** Read the **Priority**, **Size** and **Risk** cells of **Voice Notes**.
  - **Expected:**
    - **Priority** reads **Low**.
    - **Size** is empty.
    - **Risk** is empty.
  - **Notes:**

- [ ] **Step 3.** Point at the row **Voice Notes**, and select the details button at the right of its **Name** cell.
  - **Expected:**
    - Under **Planning**, **Priority** reads **Low**.
    - **Size** reads **None**, dimmed.
    - **Risk** reads **None**, dimmed.
  - **Notes:**

- [ ] **Step 4.** Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] **Step 5.** Select the **Size** cell of **Scheduler API**, and press Enter.
  - **Expected:**
    - A list of choices opens.
    - Its options read, from the top:
      - None, with a line under it
      - XS
      - S
      - M
      - L
      - XL
  - **Notes:**

- [ ] **Step 6.** Choose **L**.
  - **Expected:**
    - The cell shows **L**.
    - A hollow yellow dot is before it.
    - A light green Live row under the row reads **M** under **Size**.
  - **Notes:**

- [ ] **Step 7.** Select the **Risk** cell of **Scheduler API**, and press Enter.
  - **Expected:**
    - A list of choices opens.
    - Its options read, from the top:
      - None, with a line under it
      - Low
      - Medium
      - High
    - Each choice is on one line.
  - **Notes:**

- [ ] **Step 8.** Press Esc.
  - **Expected:**
    - The list closes.
    - The **Risk** cell still reads **Medium**.
  - **Notes:**

- [ ] **Step 9.** Sign out, and sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Operations Manager**.
  - **Notes:**

- [ ] **Step 10.** Select the **Lists** page in the left-hand menu.
  - **Expected:** The page is titled **Lists**.
  - **Notes:**

- [ ] **Step 11.** Select **Feature sizes**.
  - **Expected:**
    - The panel opens with **Feature sizes** at the top.
    - Its choices read, from the top, **XS**, **S**, **M**, **L** and **XL**.
    - Under the choices, in grey, a line reads **A feature's rough size, before it is estimated, smallest first.**
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.
