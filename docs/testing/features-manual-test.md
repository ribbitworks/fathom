---
title: "Manual Test: Features"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/features.md"]
last_updated: "2026-11-27"
---

# Manual Test: Features

## Scope

Verifies the Features page:

- How the table reads, grouped by cycle, release and project, two levels deep, with the +1 after a feature shown under two headings.
- Adding and changing features as drafts, a month typed in **Needed by**, the **Risk** list, and effort shown and typed in the unit chosen.
- A note written in New feature, in a panel under it.
- A column added to Features and its approval, and a column added with a new list made in its dialog.

[Feature Links](feature-links-manual-test.md) verifies the projects and proposals that name a feature.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Engineering Director:** `engineering.director@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Reset the Database](manual-test-basics.md#reset-the-database), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the left-hand menu, marks, the Group by menu and group headings. This test adds:

- **+1:** the small grey mark after a feature's name in a grouped table, when the feature also shows under another heading. Pointing at it shows a tip naming the other heading.
- **Count:** the grey words in the bar above the table, after the **Views** button and any filter pills, such as "22 features".

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
    - The count reads "22 features".
    - The rows show as one list, with no group headings, and the button after **Metrics** reads **Group by**.
  - **Notes:**

- [ ] `6BDE` Look at the rows, the column headers and the lines between the rows.
  - **Expected:**
    - Every word is easy to read.
    - Each line between rows is one thin line running straight across the whole table.
  - **Notes:**

- [ ] `F55A` Look at the **Feature team** cell of the row 'Scheduler API'.
  - **Expected:**
    - The cell shows "No feature team" in red, with no box and no dot.
    - The words start in line with the text of the cells above and below.
  - **Notes:**

### FEAT-02: Features Group by Cycle, With Later Last

Covered by [FEAT-28](#feat-28-features-group-by-cycle-then-by-status), and by [MEMBER-02](team-member-workflows-manual-test.md#member-02-a-team-member-sees-whats-planned-without-changing-it) in Team Member Workflows.

### FEAT-03: A Planned Feature With No Feature Team Is Marked

Covered by [FEAT-01](#feat-01-the-table-reads-well).

### FEAT-04: Adding and Changing Features Makes Drafts

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-01 ended with.

**Preconditions:** **Features** page open, in one list, as FEAT-01 leaves it.

- [ ] `D7BE` In the empty row at the end of the table, type `Fictional Reports` in **Name**, then press Enter.
  - **Expected:**
    - A hollow yellow dot is in the row's slot.
    - The row is tinted faint yellow.
    - **Status** reads "Possible".
  - **Notes:**

- [ ] `24AE` In the row 'Report Builder', select the **Target cycle** cell, and press Enter.
  - **Expected:** A list of cycles opens, each choice naming its schedule and cycle.
  - **Notes:**

- [ ] `F7F1` Choose another cycle from the list.
  - **Expected:**
    - The new cycle has a hollow yellow dot before it.
    - A light green Live row under the row shows the old cycle, with a green dot before it.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

### FEAT-05: An Approver Approves a Feature's Draft

Covered by [PRODUCT-03](product-manager-workflows-manual-test.md#product-03-a-feature-is-planned-for-a-cycle-and-a-month) in Product Manager Workflows.

### FEAT-06: Feature Drafts Show on the Drafts Page

Proved by automated tests in `apps/web/src/drafts-page-plan.test.tsx`.

### FEAT-07: Those Who Only See the Plan Cannot Change Features

Covered by [MEMBER-02](team-member-workflows-manual-test.md#member-02-a-team-member-sees-whats-planned-without-changing-it) in Team Member Workflows, with the server's refusals proved by automated tests in `apps/server/src/feature-column-values.test.ts`.

### FEAT-08: Features Follow a Cycle That Changes Length

Covered by [REL-23](release-cycles-manual-test.md#rel-23-a-cycles-new-length-moves-the-cycles-and-releases-after-it) and [REL-24](release-cycles-manual-test.md#rel-24-approving-one-draft-of-a-new-length-approves-them-all) in Release Cycles.

### FEAT-09: The Keyboard Moves Across Group Headings

Proved by automated tests in `apps/web/src/grid-groups.test.tsx`.

### FEAT-10: Needed By Takes a Month and Shows Its Name

Proved by automated tests in `apps/web/src/project-grids.test.tsx` and `apps/web/e2e/row-marks.test.ts`.

### FEAT-11: Customers and the Note

Covered by [SCOPE-01](scope-history-manual-test.md#scope-01-a-features-customers-and-notes-in-its-details) in Scope History, which reads a feature's customers and note in its details.

### FEAT-12: Features Group by the Month They Are Needed

Proved by automated tests in `apps/web/src/feature-table.test.tsx`, `apps/web/src/group-order.test.ts`, `apps/web/src/projects-page-features.test.tsx` and `apps/web/src/feature-board-view.test.tsx`.

### FEAT-13: Feature Statuses Are a List With Meanings

Covered by [LIST-01](lists-manual-test.md#list-01-built-in-lists-are-marked) in Lists.

### FEAT-14: A Feature's Details Open Beside the Table

Covered by [SCOPE-01](scope-history-manual-test.md#scope-01-a-features-customers-and-notes-in-its-details) in Scope History.

### FEAT-15: Those Who Only See the Plan See Added Columns

Proved by automated tests in `apps/server/src/feature-column-values.test.ts` and `apps/web/src/projects-page-feature-columns.test.tsx`.

### FEAT-16: A Column Is Added to Features as a Draft

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-10 ended with.

**Preconditions:** **Features** page open from the left-hand menu.

- [ ] `034F` Select **New column**.
  - **Expected:**
    - The **New column** dialog opens, and **Type** reads **Text**.
    - It has the fields **Name**, **Type** and **Required**.
    - There is no **Offered on planned hires**.
  - **Notes:**

- [ ] `E03F` Type `Fictional Score` in **Name**.
  - **Expected:** **Name** holds `Fictional Score`.
  - **Notes:**

- [ ] `D48D` Select **Add column**.
  - **Expected:**
    - The dialog closes.
    - A `Fictional Score` column is added at the right end of the table, after **Kind**.
    - The column is tinted faint yellow.
    - A hollow yellow dot is before `Fictional Score` in its header.
  - **Notes:**

- [ ] `933E` Run Publish.
  - **Expected:** The dot before `Fictional Score` is now filled yellow.
  - **Notes:**

### FEAT-17: An Approver Approves a Column on Features

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from FEAT-16.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

- [ ] `C4A4` Open the `Fictional Score` column menu.
  - **Expected:** The menu offers **Approve…** and **Reject…**.
  - **Notes:**

- [ ] `21F1` Select **Approve…**.
  - **Expected:** A dialog opens, with an **Approve** button.
  - **Notes:**

- [ ] `293A` Select **Approve**.
  - **Expected:**
    - The `Fictional Score` header has no dot.
    - The column is no longer tinted.
    - `Fictional Score` stays at the right end of the table, after **Kind**.
  - **Notes:**

**Afterwards:** Run Reset the Database.

### FEAT-18: A Value in an Added Column Is Part of a Feature's Draft

Proved by automated tests in `apps/server/src/feature-column-values.test.ts` and `apps/web/src/projects-page-feature-columns.test.tsx`.

### FEAT-19: Deleting a Column Removes It From Features

Proved by automated tests in `apps/web/src/projects-page-feature-columns.test.tsx` and `apps/server/src/feature-column-values.test.ts`.

### FEAT-20: New Feature Writes a Note in Its Own Panel

**Account:** Product Manager, `product.manager@fathom.test`, changed from FEAT-17.

**Preconditions:** Reset the Database run after FEAT-17. Signed in with this account. **Features** page open from the left-hand menu.

- [ ] `9AB0` Select **New feature**.
  - **Expected:**
    - The **New feature** panel opens beside the table.
    - The **Notes** row reads "None", with no text box for the note.
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

- [ ] `C7AB` In the **New feature** panel, change **Name** to `Fictional Atlas Two`.
  - **Expected:**
    - **Name** shows what was typed.
    - The note's panel stays open.
  - **Notes:**

- [ ] `1D2A` Select **Save** in the note's panel.
  - **Expected:**
    - The note's panel closes.
    - The **Notes** row shows `First words`.
    - **Name** still reads `Fictional Atlas Two`.
  - **Notes:**

- [ ] `886E` Select **Add** at the foot of the **New feature** panel.
  - **Expected:**
    - The feature's details show beside the table, with a hollow yellow dot before `Fictional Atlas Two`.
    - `First words` is under **Notes**.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

### FEAT-21: Effort Shows in the Unit Chosen

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-20 ended with.

**Preconditions:** **Features** page open, with no side panel open.

- [ ] `B9CA` Look at the **Effort** cells of the rows 'Audit Export', 'Usage Alerts' and 'Scheduler API'.
  - **Expected:**
    - 'Audit Export' reads "316 h".
    - 'Usage Alerts' reads "424 h".
    - 'Scheduler API' is empty.
  - **Notes:**

- [ ] `2B82` Rest the pointer on "316 h".
  - **Expected:** A tip reads "316 hours", and nothing more.
  - **Notes:**

- [ ] `9BDC` Open the **Effort** column menu.
  - **Expected:**
    - Under **Show in**, the menu lists, in order:
      - **Hours**, ticked
      - **Person-days (8 hours)**
      - **Person-weeks (8h / PD, 5 days / PW)**
      - **Person-months (8h / PD, 20 days / PM)**
      - **Person-quarters (8h / PD, 60 days / PQ)**
    - Under **Decimal places**, it lists **0**, **1** and **2**, with **2** ticked.
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
    - The cell reads "2.5 PD", with a hollow yellow dot before it.
    - A light green Live row under the row shows an empty **Effort**.
  - **Notes:**

- [ ] `95FD` Select **Show details** in the ⋯ menu of 'Scheduler API'.
  - **Expected:** The details panel opens beside the table, its **Effort** row reading "2.5 person-days (20 hours)".
  - **Notes:**

- [ ] `D165` Select the change button in the **Effort** row.
  - **Expected:**
    - A field opens holding "2.5".
    - A menu beside it reads "person-days".
  - **Notes:**

- [ ] `C1C3` Press Tab twice.
  - **Expected:** The menu beside the field has focus.
  - **Notes:**

- [ ] `70BA` Using only the keyboard, choose **person-weeks** in the menu.
  - **Expected:**
    - The menu reads "person-weeks".
    - The field holds "0.5".
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

- [ ] `A7B1` Select the **×** at the top right of the details panel.
  - **Expected:**
    - The panel closes.
    - 'Scheduler API' reads "5 PD".
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FEAT-23: New Feature Takes Effort in a Unit Chosen

Proved by automated tests in `apps/web/src/projects-page-effort.test.tsx`.

### FEAT-24: Features Group by Release

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-22 ended with.

**Preconditions:** Restore the Seed Data run after FEAT-22. **Features** page opened from the left-hand menu, then **Clear view** selected in the **Views** menu above the table.

- [ ] `CD88` Select **Group by** above the table, then **Release**.
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

### FEAT-25: A Feature's Risk Is Chosen From Its List

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-24 ended with.

**Preconditions:** **Features** page open, as FEAT-24 leaves it.

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

### FEAT-26: Any Column Moves

Covered by [VIEW-07](saved-views-manual-test.md#view-07-a-column-moves-for-one-account-only) in Saved Views, and the drag by [METRICS-09](metrics-manual-test.md#metrics-09-frozen-columns-stay-in-view-while-the-table-scrolls-sideways) `E9DB` in Metrics.

### FEAT-27: Features Group by Whether Anyone Is on Them

Proved by automated tests in `apps/web/src/feature-table.test.tsx`.

### FEAT-28: Features Group by Cycle, Then by Status

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-25 ended with.

**Preconditions:** **Features** page opened from the left-hand menu, then **Clear view** selected in the **Views** menu above the table.

- [ ] `02D2` Select **Group by** above the table, then **Cycle**.
  - **Expected:**
    - The button reads **Group by: Cycle**.
    - The group headings are clearly set apart from the rows.
    - Each line between rows, above and below the group headings too, is one thin line running straight across the whole table.
    - Each heading names the schedule and the cycle, such as **Platform: 27.1**, with how many features it holds.
    - The headings for **Platform** come first, from the earliest cycle to the latest, then those for **Field Apps**, such as **Field Apps: FA26.2**.
    - The last heading is **Later**.
  - **Notes:**

- [ ] `2622` Select **Group by: Cycle**, then **Status** under **Then by**.
  - **Expected:**
    - The button reads **Group by: Cycle, then Status**.
    - Under each cycle's heading, smaller, lighter headings set in from it name feature statuses, such as **In progress**, each with how many features it holds.
  - **Notes:**

### FEAT-29: A Feature Under Two Projects Shows Under Each

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-28 ended with.

**Preconditions:** **Features** page opened from the left-hand menu, then **Clear view** selected in the **Views** menu above the table.

- [ ] `AC75` Select **Group by** above the table, then **Projects**.
  - **Expected:**
    - The button reads **Group by: Projects**.
    - The headings read, from the top:
      - **Clinic Booking Rollout**
      - **P-2001 Crane Control**
      - **P-2017 Depot Operations**
      - **Internal Tools**
      - **P-1984 Transit Displays Phase 2**
      - **No projects**
    - 'Offline Sync' is under both **Clinic Booking Rollout** and **P-2001 Crane Control**.
  - **Notes:**

- [ ] `FCD5` Point at the **+1** after 'Offline Sync' under **Clinic Booking Rollout**.
  - **Expected:** A tip reads "Also under P-2001 Crane Control".
  - **Notes:**

### FEAT-30: Metrics Adds Up Effort

Proved by automated tests in `apps/web/src/projects-page-effort.test.tsx`, `apps/web/src/metrics-panel.test.tsx` and `apps/web/src/features-metrics.test.tsx`.

### FEAT-31: The Product Manager Adds a Project From a Feature's Projects

Covered by [PROJ-17](projects-manual-test.md#proj-17-the-product-manager-adds-a-project-from-a-new-milestones-row) and [PROJ-20](projects-manual-test.md#proj-20-the-product-manager-adds-a-new-feature-to-a-proposal) in Projects.

### FEAT-32: A Column Is Added With a New List

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-29 ended with.

**Preconditions:** **Features** page open from the left-hand menu.

- [ ] `0C22` Select **New column**.
  - **Expected:** The **New column** dialog opens.
  - **Notes:**

- [ ] `5B1E` Choose **Choice from a list** under **Type**.
  - **Expected:** **Type** reads **Choice from a list**, with **List** and **Several choices** under it.
  - **Notes:**

- [ ] `D9A0` Type `Fictional Tier` in **Name**.
  - **Expected:** **Name** holds `Fictional Tier`.
  - **Notes:**

- [ ] `9B4B` Choose **New list** under **List**.
  - **Expected:**
    - **New list** is the last choice offered, under a line, in blue.
    - Under **List**, **List name** and **Choices** show, with a row starting with **+** under **Choices**.
  - **Notes:**

- [ ] `4CA2` Type `Fictional Tiers` in **List name**.
  - **Expected:** **List name** holds `Fictional Tiers`, with no message under it.
  - **Notes:**

- [ ] `F802` In the row starting with **+**, type `Gold` and press Enter.
  - **Expected:** **Gold** shows in a row of its own above it, and the **+** row is empty again.
  - **Notes:**

- [ ] `6E8E` Copy these two lines, then paste them into the **+** row:

  ```text
  Silver
  Bronze
  ```

  - **Expected:** **Gold**, **Silver** and **Bronze** show, in that order.
  - **Notes:**

- [ ] `C79F` Select **Add column**.
  - **Expected:**
    - The dialog closes.
    - A `Fictional Tier` column is added at the right end of the table, with a hollow yellow dot before its name in its header.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

### FEAT-33: The Product Manager Approves a Column on Features

Covered by [FEAT-17](#feat-17-an-approver-approves-a-column-on-features), with who approves proved by automated tests in `apps/server/src/columns-approved-by-table.test.ts`.
