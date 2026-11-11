---
title: "Manual Test: Features"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-10"
---

# Manual Test: Features

## Scope

Verifies the Features page: how the table of features looks and reads, its groups by cycle with Later, by release and by the month needed, the Release column, entering a month, customers and a note, the list of feature statuses, editing features as drafts, who may change them, how feature drafts show on the Drafts page and when a cycle changes length, columns added to Features, writing a note in New feature, and a feature's effort, shown and typed in the unit chosen. The projects and proposals that name a feature are verified in [Feature Links](feature-links-manual-test.md).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`
- **Team Member:** `team.member@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Engineering Director:** `engineering.director@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the left-hand menu, marks, the Group by menu and group headings. This test adds:

- **Group heading on Features:** it names a cycle or **Later**; grouped by release, a release or **Not released yet**; grouped by the month needed, a month or **No date**.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Check each step whose expected result you see, and write anything else under its notes.

### FEAT-01: The Table Reads Well in Light and Dark

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select the **Features** page in the left-hand menu.
  - **Expected:** The page is titled **Features**. The table's columns are, in order, **Name**, **Status**, **Needed by**, **Customers**, **Projects**, **Proposals**, **Description**, **Notes**, **Target cycle**, **Release**, **Effort**, **Feature team** and **Complexity**. Beside the search box, the count reads **11 features**.
  - **Notes:**

- [ ] **Step 2.** Look down the **Status** column.
  - **Expected:** Each row reads one of **Possible**, **Planned**, **In progress**, **Done** or **Cancelled**.
  - **Notes:**

- [ ] **Step 3.** Switch Fathom between light and dark mode, and look at the group headings, the rows, the column headers and the lines between the rows.
  - **Expected:** In both modes every word is easy to read, and the group headings are clearly set apart from the rows. Each line between rows, above and below the group headings too, is one thin line running straight across the whole table, no heavier under **Name** than under the other columns.
  - **Notes:**

### FEAT-02: Features Are Grouped by Cycle, With Later Last

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-01 ended with.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** Read the group headings from top to bottom.
  - **Expected:** Each heading names the stream and the cycle, such as **Platform: 27.1**, with how many features it holds. The headings run from the earliest cycle to the latest, and the last heading is **Later**.
  - **Notes:**

- [ ] **Step 2.** Look under the heading **Later**.
  - **Expected:** The rows **Voice Notes** and **Partner Portal** are there, each with **Target cycle** empty.
  - **Notes:**

- [ ] **Step 3.** Type `offline` in the search box.
  - **Expected:** Only the row **Offline Sync** shows, under its cycle's heading. No heading without a row shows.
  - **Notes:**

- [ ] **Step 4.** Empty the search box.
  - **Expected:** Every heading and row is back, as in Step 1.
  - **Notes:**

- [ ] **Step 5.** Select **Group by: Cycle** above the table, then **None**.
  - **Expected:** The headings are gone and the 11 rows show as one list.
  - **Notes:**

- [ ] **Step 6.** Reload the page.
  - **Expected:** The rows still show as one list.
  - **Notes:**

- [ ] **Step 7.** Select **Group by: None**, then **Cycle**.
  - **Expected:** The headings are back, as in Step 1.
  - **Notes:**

### FEAT-03: A Planned Feature With No Feature Team Is Marked

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-02 ended with.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** Look at the **Feature team** cell of the row **Scheduler API**.
  - **Expected:** The cell has a red dot and **No team**, starting in line with the text of the cells above and below.
  - **Notes:**

- [ ] **Step 2.** Look at the **Feature team** cell of the row **Voice Notes**.
  - **Expected:** The cell is empty, with no mark.
  - **Notes:**

### FEAT-04: Adding and Changing Features Makes Drafts

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-03 ended with.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** Look at the empty row at the end of the table.
  - **Expected:** Every cell of the empty row is blank.
  - **Notes:**

- [ ] **Step 2.** In the empty row at the end of the table, type `Fictional Reports` in **Name**, then press Enter.
  - **Expected:** The row is tinted as a draft, with a hollow yellow dot and **Draft: added**, and its **Status** reads **Possible**. It stays where it is until the view next changes.
  - **Notes:**

- [ ] **Step 3.** Reload the page.
  - **Expected:** **Fictional Reports** is under the heading **Later**, with the same mark.
  - **Notes:**

- [ ] **Step 4.** In the row **Report Builder**, select the **Target cycle** cell and choose another cycle from the list.
  - **Expected:** Each choice names its stream and cycle. The cell turns yellow, with a light green row under it, marked **Live**, showing the old cycle. The row keeps its place until the view next changes.
  - **Notes:**

- [ ] **Step 5.** Select **Publish** in the top bar.
  - **Expected:** The dots on both rows are filled.
  - **Notes:**

### FEAT-05: An Approver Approves a Feature's Draft

**Account:** Project Manager, `project.manager@fathom.test`, changed from FEAT-04.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select the **⋯** menu of the row **Report Builder**.
  - **Expected:** The menu names the feature and the change to **Target cycle**, and offers **Approve…** and **Reject…**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve…**, then **Approve**.
  - **Expected:** The row has no mark and no **Live** row, and shows under the heading of its new cycle.
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
  - **Expected:** The table shows, with no **New feature** button and no empty row at its end.
  - **Notes:**

- [ ] **Step 2.** Double-click the **Status** cell of any row.
  - **Expected:** The cell does not open for editing.
  - **Notes:**

### FEAT-08: Features Follow a Cycle That Changes Length

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FEAT-07.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** In the side panel's **Cycles** table, find the row whose dates include today. Select the **⋯** button at the end of the row directly below it, then **Change length…**.
  - **Expected:** A dialog titled **Change the length of** that cycle opens.
  - **Notes:**

- [ ] **Step 2.** Replace **3** in **Length** with `2`.
  - **Expected:** Below **New dates**, **Releases that move** names **Harbor 3**, and **Features that move** names **Data Retention Controls** and **Report Builder**.
  - **Notes:**

- [ ] **Step 3.** Select **Change length**.
  - **Expected:** A notification says **Drafted the new length.**
  - **Notes:**

- [ ] **Step 4.** Select **Publish** in the top bar.
  - **Expected:** The **Publish** button is gone from the top bar.
  - **Notes:**

- [ ] **Step 5.** Sign out, sign in as the Project Manager, `project.manager@fathom.test`, and select the **Drafts** page in the left-hand menu.
  - **Expected:** The list has entries naming **the feature Data Retention Controls** and **the feature Report Builder**, and entries for **the cycles of Platform**.
  - **Notes:**

- [ ] **Step 6.** Tick one entry for **the cycles of Platform**, then select **Reject**.
  - **Expected:** The dialog lists the moved features among the drafts it includes, each by name.
  - **Notes:**

- [ ] **Step 7.** Type a reason, then confirm.
  - **Expected:** Each of those entries shows a red dot and **Rejected**.
  - **Notes:**

### FEAT-09: The Keyboard Moves Across Group Headings

**Account:** Product Manager, `product.manager@fathom.test`, changed from FEAT-08.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select the **Name** cell of the last row under a group heading, then press the Down arrow.
  - **Expected:** The selection moves to the **Name** cell of the first row under the next heading, without stopping on the heading.
  - **Notes:**

### FEAT-10: Needed By Takes a Month and Shows Its Name

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-09 ended with.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** In the row **Voice Notes**, select the **Needed by** cell, type `203003`, then press Enter.
  - **Expected:** While typing, the cell reads **2030-03**. Afterwards it reads **Mar 2030**, and the cell turns yellow, with a light green row under it, marked **Live**, showing an empty **Needed by**.
  - **Notes:**

- [ ] **Step 2.** In the row **Scheduler API**, select the **Needed by** cell, type `203013`, then press Enter.
  - **Expected:** The value is refused, and the message reads **Needed by: use a month such as 2027-03**.
  - **Notes:**

- [ ] **Step 3.** Press Escape.
  - **Expected:** The cell is empty again.
  - **Notes:**

### FEAT-11: Customers, the Description and the Note

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-10 ended with.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** In the row **Scheduler API**, select the **Customers** cell and pick the first two customers offered.
  - **Expected:** The cell shows both customers' names, and turns yellow as a draft.
  - **Notes:**

- [ ] **Step 2.** In the row **Scheduler API**, select the **Description** cell, replace its text with 201 letters, then press Enter.
  - **Expected:** The value is refused, and the message reads **Description too long**.
  - **Notes:**

- [ ] **Step 3.** Press Escape.
  - **Expected:** The description is back as it was.
  - **Notes:**

- [ ] **Step 4.** In the row **Offline Sync**, select the **Notes** cell.
  - **Expected:** A side panel titled **Notes** opens beside the table, showing the note with bold words and a bulleted list, formatted as written.
  - **Notes:**

- [ ] **Step 5.** Close the side panel, then look at the **Notes** cell of the row **Offline Sync** in light and dark mode.
  - **Expected:** The cell shows the start of the note as plain words, easy to read in both modes.
  - **Notes:**

### FEAT-12: Features Group by the Month They Are Needed

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-11 ended with.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select **Group by: Cycle** above the table, then **Needed by**.
  - **Expected:** The button reads **Group by: Needed by**. Each heading names a month and year, such as **Mar 2027**, with how many features it holds. The headings run from the earliest month to the latest, and the last heading is **No date**.
  - **Notes:**

- [ ] **Step 2.** Reload the page.
  - **Expected:** The headings are still by month.
  - **Notes:**

- [ ] **Step 3.** Select **Group by: Needed by**, then **None**.
  - **Expected:** The headings are gone and the rows show as one list. The button reads **Group by: None**.
  - **Notes:**

- [ ] **Step 4.** Select **Group by: None**, then **Cycle**.
  - **Expected:** The headings name cycles again, with **Later** last.
  - **Notes:**

### FEAT-13: Feature Statuses Are a List With Meanings

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FEAT-12.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select the **Lists** page in the left-hand menu, then select **Feature statuses** in the table.
  - **Expected:** The list is marked **Built in**. Its choices are, in order, **Possible**, **Planned**, **In progress**, **Done** and **Cancelled**, each beside a meaning of the same name.
  - **Notes:**

- [ ] **Step 2.** Read the lines under the choices.
  - **Expected:** They invite renaming, adding and retiring, say what each of the five meanings is, and end with **Keep at least one choice for each.**
  - **Notes:**

- [ ] **Step 3.** In the empty row of the choices, type `Long shot`, choose the meaning **Possible**, then press Enter.
  - **Expected:** **Long shot** is added as a draft, with **Possible** as its meaning.
  - **Notes:**

### FEAT-14: A Feature's Details Open Beside the Table

**Account:** Product Manager, `product.manager@fathom.test`, changed from FEAT-13.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **Features** page open.

- [ ] **Step 1.** Point at the row **Offline Sync**, then select the small button with an arrow at the right of its **Name** cell.
  - **Expected:** A side panel titled **Offline Sync** opens beside the table, listing **Name**, **Status**, **Needed by**, **Customers**, **Projects**, **Proposals**, **Description**, **Notes**, **Target cycle**, **Release**, **Effort**, **Feature team** and **Complexity**.
  - **Notes:**

- [ ] **Step 2.** In the side panel, select a customer's name under **Customers**.
  - **Expected:** The **Projects** page opens on its **Customers** tab, with that customer's details in the side panel.
  - **Notes:**

### FEAT-15: Those Who Only See the Plan See Added Columns

**Account:** Team Member, `team.member@fathom.test`, changed from FEAT-14.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account.

- [ ] **Step 1.** Select the **Features** page in the left-hand menu, and scroll right to the **Complexity** column.
  - **Expected:** There is no **New column** button. The row **Offline Sync** shows **L**, **Mobile Approvals** shows **M**, **Data Retention Controls** shows **S** and **Report Builder** shows **XL**. **Usage Alerts** is empty.
  - **Notes:**

- [ ] **Step 2.** Open the **Complexity** column menu.
  - **Expected:** The menu offers sorting and filtering, with no **Edit column**, **Move left** or **Move right**.
  - **Notes:**

- [ ] **Step 3.** Switch Fathom between light and dark mode, and look at the **Complexity** column.
  - **Expected:** The header and values read as clearly as the columns beside them in both modes.
  - **Notes:**

### FEAT-16: A Column Is Added to Features as a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FEAT-15.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select **New column**.
  - **Expected:** The **New column** dialog opens, with the fields **Name**, **Type**, **List**, **Several choices** and **Must be filled in**. There is no **Offered on planned hires**.
  - **Notes:**

- [ ] **Step 2.** Open the **List** box.
  - **Expected:** **Complexity** is offered. No list marked **Restricted** or **Confidential** is offered.
  - **Notes:**

- [ ] **Step 3.** Set **Type** to **Number**.
  - **Expected:** The **List** box and **Several choices** go, and no box asking who may see the values appears.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional Risk` in **Name**, then select **Add column**.
  - **Expected:** The dialog closes. A **Fictional Risk** column is added at the right end of the table, tinted blue, with a yellow dot and **Draft** under its name.
  - **Notes:**

- [ ] **Step 5.** Double-click the **Fictional Risk** cell of any row.
  - **Expected:** The cell does not open for editing while the column is a draft.
  - **Notes:**

- [ ] **Step 6.** Open the **Fictional Risk** column menu.
  - **Expected:** The menu offers **Edit column** and has no **Move left** or **Move right**.
  - **Notes:**

- [ ] **Step 7.** Select **Edit column**.
  - **Expected:** The **Edit column** dialog opens, with **Type** greyed out and no **Delete column** button.
  - **Notes:**

- [ ] **Step 8.** Select **Cancel**.
  - **Expected:** The dialog closes and nothing has changed.
  - **Notes:**

- [ ] **Step 9.** Select **Publish** in the top bar.
  - **Expected:** The dot beside **Draft** under **Fictional Risk** is filled.
  - **Notes:**

### FEAT-17: An Approver Approves a Column on Features

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from FEAT-16.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The list has an entry naming **the column Fictional Risk on Features**, drafted by **Engineering Operations Manager**.
  - **Notes:**

- [ ] **Step 2.** Select the **Features** page in the left-hand menu, then open the **Fictional Risk** column menu.
  - **Expected:** The menu offers **Approve…** and **Reject…**.
  - **Notes:**

- [ ] **Step 3.** Select **Approve…**, then **Approve**.
  - **Expected:** The **Draft** mark goes from the **Fictional Risk** header and the blue tint goes from the column. **Fictional Risk** stays at the right end of the table, after **Complexity**.
  - **Notes:**

### FEAT-18: A Value in an Added Column Is Part of a Feature's Draft

**Account:** Product Manager, `product.manager@fathom.test`, changed from FEAT-17.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Double-click the **Fictional Risk** cell of the row **Usage Alerts**, type `3.5` and press Enter.
  - **Expected:** The cell shows **3.5**, and the row has a yellow dot and **Draft**, with a **Live** row under it whose **Fictional Risk** cell is empty.
  - **Notes:**

- [ ] **Step 2.** Double-click the **Complexity** cell of the same row, and choose **XS**.
  - **Expected:** The cell shows **XS**, and the **Live** row's **Complexity** cell stays empty.
  - **Notes:**

- [ ] **Step 3.** Select the **Drafts** page in the left-hand menu, and find **the feature Usage Alerts**.
  - **Expected:** Its entry names both changes, **Fictional Risk** to **3.5** and **Complexity** to **XS**.
  - **Notes:**

- [ ] **Step 4.** Select the **Features** page in the left-hand menu, and point at the row **Usage Alerts**. Select the small button with an arrow at the right of its **Name** cell.
  - **Expected:** The side panel lists **Fictional Risk** and **Complexity**, each with the drafted value and the live value under it.
  - **Notes:**

- [ ] **Step 5.** Close the side panel, then select **Publish** in the top bar.
  - **Expected:** The dot beside **Draft** on the row **Usage Alerts** is filled.
  - **Notes:**

- [ ] **Step 6.** Select **New feature**.
  - **Expected:** The form offers **Complexity** and **Fictional Risk**.
  - **Notes:**

- [ ] **Step 7.** Select **Cancel**.
  - **Expected:** The form closes.
  - **Notes:**

- [ ] **Step 8.** Sign in as the Project Manager account, `project.manager@fathom.test`, open **Features**, open the **⋯** menu of the row **Usage Alerts**, and select **Approve…**, then **Approve**.
  - **Expected:** The row has no mark and no **Live** row, and still shows **3.5** and **XS**.
  - **Notes:**

### FEAT-19: Deleting a Column Removes It From Features

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from FEAT-18.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Open the **Fictional Risk** column menu and select **Edit column**.
  - **Expected:** The **Edit column** dialog opens with a red **Delete column** button.
  - **Notes:**

- [ ] **Step 2.** Select **Delete column**.
  - **Expected:** The dialog closes, and a notice reads **Deleted the Fictional Risk column.** The column stays in the table, with a yellow dot and **Draft** under its name.
  - **Notes:**

- [ ] **Step 3.** Select **Publish** in the top bar.
  - **Expected:** The dot beside **Draft** under **Fictional Risk** is filled.
  - **Notes:**

- [ ] **Step 4.** Open the **Fictional Risk** column menu, and select **Approve…**, then **Approve**.
  - **Expected:** The **Fictional Risk** column is gone, and the table ends with **Complexity**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-20: New Feature Writes a Note in Its Own Panel

**Account:** Product Manager, `product.manager@fathom.test`, changed from FEAT-19.

**Preconditions:** Restore the Seed Data run after FEAT-19. Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select **New feature**.
  - **Expected:** The **New feature** panel opens beside the table, laid out as the **New person** panel on **People** is: each label at the left of its row, under the headings **Details** and **Columns**. The **Notes** row has **None** as its value and a pencil button at its right. There is no text box for the note.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional Atlas` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 3.** Select the pencil button in the **Notes** row.
  - **Expected:** A second panel opens under **New feature**, titled **Notes for New feature**, with **Note**, **Editor** and **Markdown** at its top, on **Editor**, and a toolbar under the text. **Fictional Atlas** is still in **Name**.
  - **Notes:**

- [ ] **Step 4.** Switch the page to dark mode and back to light mode.
  - **Expected:** Both panels are easy to read in both modes.
  - **Notes:**

- [ ] **Step 5.** Type `First words` in the editor, and select them.
  - **Expected:** The words are highlighted.
  - **Notes:**

- [ ] **Step 6.** Select **Bold** in the toolbar.
  - **Expected:** **First words** is bold in the editor.
  - **Notes:**

- [ ] **Step 7.** In the **New feature** panel, change **Name** to `Fictional Atlas Two`.
  - **Expected:** **Name** shows what was typed, and the note's panel stays open.
  - **Notes:**

- [ ] **Step 8.** Select **Save** in the note's panel.
  - **Expected:** The note's panel closes. The **Notes** row shows **First words** in bold, and **Name** still reads **Fictional Atlas Two**.
  - **Notes:**

- [ ] **Step 9.** Select the pencil button in the **Notes** row.
  - **Expected:** The note's panel opens, showing the note as it reads.
  - **Notes:**

- [ ] **Step 10.** Select **Editor**, and type more words.
  - **Expected:** The words appear in the editor.
  - **Notes:**

- [ ] **Step 11.** Select **Cancel** in the **New feature** panel.
  - **Expected:** A box asks **Discard the new feature?**, with **Keep adding** and **Discard**.
  - **Notes:**

- [ ] **Step 12.** Select **Keep adding**.
  - **Expected:** The box closes, and both panels stay open.
  - **Notes:**

- [ ] **Step 13.** Select **Cancel** in the note's panel.
  - **Expected:** The note's panel closes, and the **Notes** row still shows only **First words**.
  - **Notes:**

- [ ] **Step 14.** Select **Add** at the foot of the **New feature** panel.
  - **Expected:** The feature is added as a draft, and its details show beside the table, with **First words** in bold under **Notes**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-21: Effort Shows in the Unit Chosen

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-20 ended with.

**Preconditions:** Restore the Seed Data run after FEAT-20. **Features** page open.

- [ ] **Step 1.** Find the **Effort** column, after **Release**, and look at the rows **Audit Export**, **Usage Alerts** and **Scheduler API**.
  - **Expected:** **Audit Export** reads **316 h**, **Usage Alerts** reads **424 h**, and **Scheduler API** is empty.
  - **Notes:**

- [ ] **Step 2.** Rest the pointer on **316 h**.
  - **Expected:** A tooltip reads **316 hours**, and nothing more.
  - **Notes:**

- [ ] **Step 3.** Select the **Release** cell of **Audit Export**, then press the Right arrow key once.
  - **Expected:** The **Effort** cell of **Audit Export** is selected, and a tooltip beside it reads **316 hours**.
  - **Notes:**

- [ ] **Step 4.** Open the column menu of **Effort**.
  - **Expected:** Under **Show in**, the menu lists **Hours**, **Person-days**, **Person-weeks**, **Person-months** and **Person-quarters**, in that order, with a tick beside **Hours** only. Under **Decimal places**, it lists **0**, **1** and **2**, with a tick beside **2** only. It has no **Break down by**.
  - **Notes:**

- [ ] **Step 5.** Select **Person-days**.
  - **Expected:** The menu closes. **Audit Export** reads **39.5 PD**, and **Usage Alerts** reads **53 PD**.
  - **Notes:**

- [ ] **Step 6.** Rest the pointer on **39.5 PD**.
  - **Expected:** A tooltip reads **316 hours**.
  - **Notes:**

- [ ] **Step 7.** Open the column menu of **Effort**, and select **Person-weeks**.
  - **Expected:** **Audit Export** reads **8 PW**, and **Usage Alerts** reads **10.6 PW**.
  - **Notes:**

- [ ] **Step 8.** Rest the pointer on **8 PW**.
  - **Expected:** A tooltip reads **316 hours, rounded up**.
  - **Notes:**

- [ ] **Step 9.** Open the column menu of **Effort**, and select **Person-months**.
  - **Expected:** **Audit Export** reads **2 PM**, **Usage Alerts** reads **2.65 PM**, and **Bulk Import** reads **1.5 PM**.
  - **Notes:**

- [ ] **Step 10.** Open the column menu of **Effort**, and select **Person-quarters**.
  - **Expected:** **Audit Export** reads **0.67 PQ**, **Usage Alerts** reads **0.89 PQ**, and **Bulk Import** reads **0.5 PQ**.
  - **Notes:**

- [ ] **Step 11.** Open the column menu of **Effort**, and select **Person-months**.
  - **Expected:** **Usage Alerts** reads **2.65 PM**.
  - **Notes:**

- [ ] **Step 12.** Open the column menu of **Effort**, and select **1** under **Decimal places**.
  - **Expected:** **Audit Export** reads **2 PM**, **Usage Alerts** reads **2.7 PM**, and **Bulk Import** reads **1.5 PM**.
  - **Notes:**

- [ ] **Step 13.** Rest the pointer on **2.7 PM**.
  - **Expected:** A tooltip reads **424 hours, rounded up**.
  - **Notes:**

- [ ] **Step 14.** Open the column menu of **Effort**, and select **0** under **Decimal places**.
  - **Expected:** **Usage Alerts** reads **3 PM**, and **Bulk Import** reads **2 PM**.
  - **Notes:**

- [ ] **Step 15.** Reload the page.
  - **Expected:** **Effort** still shows person-months with no decimal places: **Usage Alerts** reads **3 PM**.
  - **Notes:**

- [ ] **Step 16.** Open the **Views** menu.
  - **Expected:** It lists **Units: Effort in person-months to 0 decimal places**.
  - **Notes:**

- [ ] **Step 17.** Press Escape, then switch the page to dark mode.
  - **Expected:** The page turns dark.
  - **Notes:**

- [ ] **Step 18.** Rest the pointer on **3 PM**.
  - **Expected:** The cells and the tooltip are easy to read.
  - **Notes:**

- [ ] **Step 19.** Open the column menu of **Effort**.
  - **Expected:** The column menu is easy to read.
  - **Notes:**

- [ ] **Step 20.** Press Escape, then switch the page back to light mode.
  - **Expected:** The page turns light.
  - **Notes:**

- [ ] **Step 21.** Open the **Views** menu, and select **Units: Effort in person-months to 0 decimal places**.
  - **Expected:** **Audit Export** reads **316 h** again.
  - **Notes:**

### FEAT-22: Effort Is Typed in the Unit Shown and Rounded Up

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-21 ended with.

**Preconditions:** **Features** page open, **Effort** shown in hours to 2 decimal places, as the column menu of **Effort** shows with ticks beside **Hours** and **2**.

- [ ] **Step 1.** Open the column menu of **Effort**, and select **Person-days**.
  - **Expected:** **Audit Export** reads **39.5 PD**.
  - **Notes:**

- [ ] **Step 2.** In the row **Scheduler API**, select the **Effort** cell, type `2.2`, then press Enter.
  - **Expected:** The cell reads **2.5 PD** and turns yellow, with a light green row under it, marked **Live**, showing an empty **Effort**.
  - **Notes:**

- [ ] **Step 3.** Select the yellow **Effort** cell of **Scheduler API**, the one reading **2.5 PD**, and press Enter.
  - **Expected:** A field opens in the cell holding **2.5**, with **PD** after it.
  - **Notes:**

- [ ] **Step 4.** Press Enter without changing the field.
  - **Expected:** The field closes, and the cell still reads **2.5 PD**.
  - **Notes:**

- [ ] **Step 5.** Select the yellow **Effort** cell of **Scheduler API** again, type `-1`, then press Enter.
  - **Expected:** The value is refused, and the message reads **Effort: use 0 or more**.
  - **Notes:**

- [ ] **Step 6.** Press Escape.
  - **Expected:** The cell reads **2.5 PD** again.
  - **Notes:**

- [ ] **Step 7.** Select **Show details** in the **⋯** menu of **Scheduler API**.
  - **Expected:** The details panel opens beside the table, with an **Effort** row reading **2.5 person-days (20 hours)**.
  - **Notes:**

- [ ] **Step 8.** Select the pencil button in the **Effort** row.
  - **Expected:** A field opens holding **2.5**, with a menu beside it reading **person-days**.
  - **Notes:**

- [ ] **Step 9.** Press Tab twice, past the field's **×**.
  - **Expected:** The menu beside the field has focus, and the field stays open.
  - **Notes:**

- [ ] **Step 10.** Press Escape.
  - **Expected:** The field closes, and the **Effort** row still reads **2.5 person-days (20 hours)**.
  - **Notes:**

- [ ] **Step 11.** Select the pencil button in the **Effort** row.
  - **Expected:** A field opens holding **2.5**, with a menu beside it reading **person-days**.
  - **Notes:**

- [ ] **Step 12.** Select **hours** in the menu beside the field.
  - **Expected:** The field now holds **20**, and the menu reads **hours**.
  - **Notes:**

- [ ] **Step 13.** Change the field to `28`, then press Enter.
  - **Expected:** The **Effort** row reads **3.5 person-days (28 hours)**, and in the table **Scheduler API** reads **3.5 PD**.
  - **Notes:**

- [ ] **Step 14.** Select the pencil button in the **Effort** row, then press Tab twice.
  - **Expected:** The field holds **3.5**, and the menu beside it, reading **person-days**, has focus.
  - **Notes:**

- [ ] **Step 15.** Using only the keyboard, choose **person-weeks** in the menu.
  - **Expected:** The menu reads **person-weeks**, and the field holds **0.8**.
  - **Notes:**

- [ ] **Step 16.** Press Shift+Tab twice, then type `1` in place of what the field holds.
  - **Expected:** The field holds **1**.
  - **Notes:**

- [ ] **Step 17.** Press Tab three times, until neither the field nor the menu has focus.
  - **Expected:** The field closes, and the **Effort** row reads **5 person-days (40 hours)**.
  - **Notes:**

- [ ] **Step 18.** Close the details panel.
  - **Expected:** The panel closes, and **Scheduler API** reads **5 PD**.
  - **Notes:**

- [ ] **Step 19.** Open the column menu of **Effort**.
  - **Expected:** It ticks **Person-days**.
  - **Notes:**

- [ ] **Step 20.** Select **Hours**.
  - **Expected:** **Scheduler API** reads **40 h**.
  - **Notes:**

- [ ] **Step 21.** Select **Show details** in the **⋯** menu of **Scheduler API**.
  - **Expected:** The panel's **Effort** row reads **40 hours**, with nothing after it.
  - **Notes:**

- [ ] **Step 22.** Close the details panel.
  - **Expected:** The panel closes.
  - **Notes:**

- [ ] **Step 23.** Select the **Drafts** page in the left-hand menu, and find the draft of **Scheduler API**.
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
  - **Expected:** The **New feature** panel opens. Its **Effort** row has an empty field, with a menu beside it reading **person-weeks**.
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
  - **Expected:** The menu reads **person-days**, and **Effort** still holds **2**. The table's **Effort** column still shows person-weeks.
  - **Notes:**

- [ ] **Step 7.** Select **Add** at the foot of the **New feature** panel.
  - **Expected:** The feature is added as a draft, and its details show beside the table, with an **Effort** row reading **0.4 person-weeks (16 hours)**. In the table, **Fictional Effort** reads **0.4 PW**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-24: Features Group by Release

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-23 ended with.

**Preconditions:** Restore the Seed Data run after FEAT-23. **Features** page open.

- [ ] **Step 1.** Select **Group by: Cycle** above the table.
  - **Expected:** The menu offers **Cycle**, **Release**, **Needed by** and **None**, with a tick beside **Cycle**.
  - **Notes:**

- [ ] **Step 2.** Select **Release**.
  - **Expected:** The button reads **Group by: Release**. The headings are, from top to bottom, **Platform: Harbor 1**, **Platform: Harbor 2** and **Platform: Harbor 3**, each followed by a comma, **ships** and a date with its day, month and year, such as **ships 31 Mar 2027**, and then **Later**. The counts beside them read **1**, **4**, **4** and **2**. No heading names a **Patches** release.
  - **Notes:**

- [ ] **Step 3.** Select the **Releases** page in the left-hand menu, then **Platform** in the table.
  - **Expected:** A side panel for **Platform** opens. Under **Releases**, each **Harbor** row ends with **ships** and a day, such as **26.3 to 26.4 · ships 2026-12-31**. Each is the same day as the heading noted in Step 2, such as **ships 31 Dec 2026** for **ships 2026-12-31**.
  - **Notes:**

- [ ] **Step 4.** Select the **Features** page in the left-hand menu, then **Group by: Cycle** above the table, then **Release**.
  - **Expected:** The headings of Step 2 show again.
  - **Notes:**

- [ ] **Step 5.** In the row **Report Builder**, under **Platform: Harbor 3**, select the **Target cycle** cell and choose the cycle after the one it shows.
  - **Expected:** The cell turns yellow, with a light green row under it, marked **Live**, showing the old cycle. The row stays under **Platform: Harbor 3** until the view next changes.
  - **Notes:**

- [ ] **Step 6.** Reload the page.
  - **Expected:** A heading **Platform: Not released yet** with the count **1** shows after **Platform: Harbor 3** and before **Later**. **Report Builder** is under it, marked **Draft**, with its **Live** row under it showing the old cycle. **Platform: Harbor 3** now counts **3**.
  - **Notes:**

- [ ] **Step 7.** Select **Group by: Release**, then **None**.
  - **Expected:** The headings are gone and the rows show as one list. The button reads **Group by: None**.
  - **Notes:**

- [ ] **Step 8.** Select **Group by: None**, then **Cycle**.
  - **Expected:** The headings name cycles again, with **Later** last.
  - **Notes:**

- [ ] **Step 9.** Find the **Release** column, after **Target cycle**, and look at the rows **Report Builder**, **Offline Sync** and **Voice Notes**.
  - **Expected:** In **Report Builder**'s draft row, **Release** reads **Platform: Not released yet**, and in its **Live** row **Platform: Harbor 3**. **Offline Sync** reads **Platform: Harbor 2**, with no date. **Voice Notes**' **Release** is empty.
  - **Notes:**

- [ ] **Step 10.** Select the small button with an arrow out of a box at the right of **Report Builder**'s **Name** cell.
  - **Expected:** The side panel lists **Release** after **Target cycle**, reading **Platform: Not released yet**, underlined as a link.
  - **Notes:**

- [ ] **Step 11.** Select **Platform: Not released yet** in the side panel.
  - **Expected:** The **Releases** page opens, with the **Platform** side panel open beside its table.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.
