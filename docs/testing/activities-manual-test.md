---
title: "Manual Test: Activities"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/pages/activities.md", "docs/design/pages/capacity.md"]
last_updated: "2026-11-27"
---

# Manual Test: Activities

## Scope

Verifies the Activities page: how its table and an activity's details look and read, adding an activity to a project, moving one to a release in its cell, following an activity's release and project to their pages, grouping by project, and a reader who may not change activities. It then verifies that Capacity shows the time people are allocated to activities.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Engineering Manager:** `engineering.manager@fathom.test`
- **Team Member:** `team.member@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the left-hand menu, marks, the Group by menu and group headings.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### ACT-01: The Table and an Activity's Details Read Clearly

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] `A54B` Select the **Activities** page in the left-hand menu.
  - **Expected:**
    - **Activities** is in the left-hand menu after **Features**, and is highlighted.
    - The heading reads **Activities**, with **New column** and **New activity** at its right.
    - The table's columns, in this order:
      - **Name**
      - **Status**
      - **Description**
      - **Notes**
      - **Release**
      - **Project**
      - **Priority**
      - **Needed by**
      - **Effort**
      - **Size**
      - **Risk**
      - **Feature team**
      - **Staffed**
    - 'Data migration' shows 'P-2001 Crane Control' under **Project**, with **P-2001** dimmed, and **Release** empty.
  - **Notes:**

- [ ] `F46D` Point at the 'Data migration' row and select the details button at the right of its **Name** cell.
  - **Expected:**
    - The details open beside the table, titled 'Data migration', with **#ACTIVITY-** and a number under the title.
    - Under **Details**: **Name**, **Status**, **Description**, **Notes**, **Release** reading **None**, and **Project** reading 'P-2001 Crane Control', with **P-2001** dimmed.
    - Under **Planning**: **Priority**, **Needed by**, **Effort**, **Size**, **Risk**, **Feature team** and **Staffed**.
  - **Notes:**

### ACT-02: An Activity Is Added to a Project

**Account:** Product Manager, `product.manager@fathom.test`, the same as ACT-01.

**Preconditions:** **Activities** page open, with the details closed.

- [ ] `E8B5` Select **New activity**.
  - **Expected:** The **New activity** form opens beside the table, with the cursor in **Name**.
  - **Notes:**

- [ ] `7DB5` Type `Cutover rehearsal` in **Name**.
  - **Expected:** **Name** reads `Cutover rehearsal`.
  - **Notes:**

- [ ] `455C` Choose 'P-2001 Crane Control' in **Project**.
  - **Expected:**
    - **Project** reads 'P-2001 Crane Control', with **P-2001** dimmed.
    - **Release** reads **None**.
  - **Notes:**

- [ ] `45A2` Select **Add**.
  - **Expected:**
    - The form closes.
    - 'Cutover rehearsal' shows in the table with a hollow yellow dot before its name.
    - Its **Project** reads 'P-2001 Crane Control'.
    - Its **Status** reads **Possible**.
  - **Notes:**

### ACT-03: An Activity Moves to a Release in Its Cell

**Account:** Product Manager, `product.manager@fathom.test`, the same as ACT-02.

**Preconditions:** **Activities** page open, with **Drafts & Live** chosen in the Draft menu.

- [ ] `E450` Select the **Release** cell of 'Operator training', press Enter, choose 'Platform: Harbor 1' and press Enter.
  - **Expected:**
    - **Release** reads 'Platform: Harbor 1' after a hollow yellow dot.
    - **Project** shows a hollow yellow dot and nothing after it.
    - A light green **Live** row under it shows a green dot and nothing after it under **Release**, and 'P-2001 Crane Control' under **Project**.
  - **Notes:**

- [ ] `1D8D` Select the **Release** cell of 'Operator training'.
  - **Expected:** The cell is outlined.
  - **Notes:**

- [ ] `532D` Press Delete.
  - **Expected:** "Choose a release or a project" shows under the row, and the cell still reads 'Platform: Harbor 1'.
  - **Notes:**

- [ ] `0372` Press Esc.
  - **Expected:** The cell reads 'Platform: Harbor 1' as before.
  - **Notes:**

**Afterwards:** Discard the Unpublished Changes.

### ACT-04: Activities Are Grouped by Project

**Account:** Product Manager, `product.manager@fathom.test`, the same as ACT-03.

**Preconditions:** **Activities** page open.

- [ ] `AB99` Choose **Project** in the Group by menu.
  - **Expected:**
    - Each project with activities has a heading, such as 'P-2001 Crane Control', counting its activities.
    - 'Data migration', 'General' and 'Operator training' are under 'P-2001 Crane Control'.
  - **Notes:**

### ACT-05: A Team Member Reads Activities Without Changing Them

**Account:** Team Member, `team.member@fathom.test`, changed from ACT-04.

**Preconditions:** Signed in with this account.

- [ ] `F57B` Select the **Activities** page in the left-hand menu.
  - **Expected:**
    - The table lists the activities.
    - There is no **New activity** or **New column** at the heading's right.
  - **Notes:**

- [ ] `1A50` Point at the 'Data migration' row and select the details button at the right of its **Name** cell.
  - **Expected:**
    - The details show the activity's values.
    - No row has a change button.
  - **Notes:**

### ACT-06: An Activity's Release and Project Lead to Their Pages

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACT-05.

**Preconditions:** Signed in with this account. **Activities** page open from the left-hand menu, with **Drafts & Live** chosen in the Draft menu, and not grouped: if it is, choose **Clear grouping** in the Group by menu.

- [ ] `04AE` Point at the 'Data migration' row and select the details button at the right of its **Name** cell.
  - **Expected:** **Project** reads 'P-2001 Crane Control' as a link, with **P-2001** dimmed.
  - **Notes:**

- [ ] `EF10` Point at **Project** in the details.
  - **Expected:** A change button shows at the right of the row.
  - **Notes:**

- [ ] `DB81` Select 'P-2001 Crane Control' under **Project**.
  - **Expected:** The **Projects** page opens, with the details of 'Crane Control' beside the table.
  - **Notes:**

- [ ] `00C3` Select the browser's Back button.
  - **Expected:** The **Activities** page shows again.
  - **Notes:**

- [ ] `6A1E` Select the **Release** cell of 'Operator training', press Enter, choose 'Platform: Harbor 1' and press Enter.
  - **Expected:** **Release** reads 'Platform: Harbor 1' after a hollow yellow dot.
  - **Notes:**

- [ ] `694C` Point at the 'Operator training' row and select the details button at the right of its **Name** cell.
  - **Expected:**
    - **Release** reads 'Platform: Harbor 1' as a link, after a hollow yellow dot.
    - Under it, the live value reads **None**.
  - **Notes:**

- [ ] `1C2C` Select 'Platform: Harbor 1' under **Release**.
  - **Expected:** The **Releases** page opens on **Schedules**, with the details of 'Platform' beside the table.
  - **Notes:**

**Afterwards:** Discard the Unpublished Changes.

### ACT-07: Capacity Shows Time on Activities

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ACT-06.

**Preconditions:** Signed in with this account.

- [ ] `795E` Select the **Capacity** page in the left-hand menu, then the **Allocations** tab.
  - **Expected:** The **Allocations** tab is chosen.
  - **Notes:**

- [ ] `F941` Type `Depot rollout` in the search box.
  - **Expected:** Each row left has a line reading "Depot rollout" in at least one month, with its percentage at the right, such as "50%".
  - **Notes:**

- [ ] `919D` Point at "Depot rollout" in a cell.
  - **Expected:** After a moment, a tooltip reads "Depot rollout (Depot Operations)".
  - **Notes:**

- [ ] `8B4C` Clear the search box.
  - **Expected:** The rows are back, with nothing in the search box.
  - **Notes:**

- [ ] `A526` Select the **Allocations** button after the search box.
  - **Expected:** Beside the features, the list offers each activity with its project, such as 'Depot rollout (Depot Operations)', 'General (Crane Control)' and 'General (Internal Tools)', each its own choice.
  - **Notes:**

- [ ] `65FB` Tick 'Depot rollout (Depot Operations)'.
  - **Expected:**
    - A pill reads "Allocated to: Depot rollout (Depot Operations)".
    - Each row left has a "Depot rollout" line in at least one month.
  - **Notes:**
