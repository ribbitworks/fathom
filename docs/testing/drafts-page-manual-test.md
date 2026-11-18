---
title: "Manual Test: Drafts Page"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-18"
---

# Manual Test: Drafts Page

## Scope

Verifies the Drafts page: its table of drafts, its three tabs and who sees each, ticking rows and the actions they bring to the page's heading, approving drafts from there, a draft's details, and publishing and discarding chosen changes with the changes they must go with. [Drafts](drafts-manual-test.md) verifies drafts on the People and Lists pages, and [Unpublished Changes](unpublished-changes-manual-test.md) publishing all changes or discarding them all from the top bar.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Director:** `engineering.director@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the page's heading, tick boxes and the details button. This test adds:

- **Tabs:** **To decide**, **Not published** and **All drafts**, just after the **Drafts** title, on the same line, each followed by a dimmed count. An account sees only the tabs its role has, and the page opens on the first of them, or on the tab it last showed.

## Test Cases

Run the test cases in the order they are listed. Start with Start Fathom, then Reset the Database. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### DRAFT-12: The Drafts Table Shows a New Order and Why It Waits

**Account:** Engineering Director, `engineering.director@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Drafts** page open from the left-hand menu, then **All drafts** selected beside the page's title.

- [ ] `54D6` Search for `Order of choices`.
  - **Expected:** Three rows are shown, whose **Record** reads 'Levels', 'Positions' and 'Sites'.
  - **Notes:**

- [ ] `F9BD` Read the row of 'Sites', from left to right.
  - **Expected:**
    - A yellow dot, then 'Sites', then a grey box reading "Waits on a rejected draft".
    - **Change** reads "Reordered".
    - **State** reads "Waiting".
    - **What changes** starts **Order** from 'Kestrel Bay', 'Northmere', 'Ashgrove', 'Corran Quay' to 'Harbourside', 'Kestrel Bay', 'Northmere Labs', 'Ashgrove', 'Corran Quay'.
    - **Type** reads "Order of choices".
    - **Area** reads "Configuration".
    - **Made by** reads "Engineering Operations Manager".
    - **Reason** is empty.
  - **Notes:**

### DRAFT-13: Rejected Drafts Are Listed Under All Drafts

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-12.

**Preconditions:** DRAFT-12 done. **Drafts** page open, on **All drafts**, with the search box empty.

- [ ] `485D` In the **State** column's menu, filter by **Rejected** alone.
  - **Expected:**
    - Each row shown starts with a red dot in a ring.
    - Each row's **State** reads "Rejected".
    - Each row's **Reason** holds its reason.
    - Nine rows are shown, whose **Record** reads 'Ophélie Roussel', '우아현', 'Payments tester', 'Positions' twice ('List' and 'Order of choices' under **Type**), 'Harbourside in Sites', 'Previous site', 'P-1984 Transit Displays Phase 2' and 'Patch January in Patches', in any order.
  - **Notes:**

- [ ] `1B99` Open the Views menu, and select **Clear view**.
  - **Expected:**
    - **All drafts** stays chosen.
    - The **State** filter is gone, and every draft is listed.
  - **Notes:**

### DRAFT-27: Drafts Are Grouped and Counted by Area

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-13.

**Preconditions:** DRAFT-13 done. **Drafts** page open, on **All drafts**, with no search, filter or grouping.

- [ ] `3A91` In the Group by menu, select **Area**.
  - **Expected:**
    - The button reads **Group by: Area**.
    - Group headings read "People", "Planned hires", "Feature teams", "Configuration", "The plan or configuration", "Features and releases" and "The plan".
    - The heading "The plan or configuration" counts 1.
    - The heading "Features and releases" counts 6.
  - **Notes:**

- [ ] `E567` In the Group by menu, select **Made by** under **Then by**.
  - **Expected:**
    - The button reads **Group by: Area, then Made by**.
    - Under "The plan or configuration", one smaller, set-in heading reads "Engineering Operations Manager", counting 1.
    - Under "Features and releases", one smaller, set-in heading reads "Product Manager", counting 6.
  - **Notes:**

- [ ] `7C55` Select **Metrics**, then **Area** under **Break down by**.
  - **Expected:**
    - A **Metrics** panel opens beside the table.
    - Its table has the columns **Area**, **Drafts** and **Share**.
    - Its row "Features and releases" reads 6 under **Drafts**.
    - Its row "The plan or configuration" reads 1 under **Drafts**.
  - **Notes:**

### DRAFT-28: The Tabs Read in Order, and Space Ticks a Row

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-27.

**Preconditions:** Signed in with this account. **Drafts** page open from the left-hand menu.

- [ ] `042E` Read the tabs beside the page's title.
  - **Expected:**
    - **To decide** comes first, chosen, followed by a dimmed 32.
    - **Not published** comes second, followed by a dimmed 0.
    - **All drafts** comes third.
  - **Notes:**

- [ ] `363B` Select the **Record** cell of the first row, away from its tick box.
  - **Expected:** The cell is outlined, and its row's tick box is not ticked.
  - **Notes:**

- [ ] `4528` Press Space.
  - **Expected:**
    - That row's tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
    - The **Record** cell still has focus.
  - **Notes:**

### DRAFT-29: A Draft's Details Show What Comes With It and Lead to Its Record

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-28.

**Preconditions:** Signed in with this account. **Drafts** page open from the left-hand menu.

- [ ] `0A9E` Search for `Silje Skills`.
  - **Expected:** One row is shown, whose **Record** reads 'Silje Holm-Schrøder'.
  - **Notes:**

- [ ] `71D2` Point at that row, and select the details button that shows at the right of its **Record** cell.
  - **Expected:** A details panel opens beside the table:
    - Its title is a yellow dot, then 'Silje Holm-Schrøder'.
    - Under **Details**, **Change** reads "Changed".
    - **State** reads "Waiting".
    - **What changes** reads **Skills** set to `Rust`.
    - **Type** reads "Person".
    - **Area** reads "People".
    - **Made by** reads "Engineering Operations Manager".
    - **Drafted** reads today's date.
    - **Reason** reads "None".
    - Under **Approved with it**, **Drafts** reads "the column Skills", "the list Skills" and "the choice Rust in Skills", one to a line.
    - Under them come the buttons **Approve…** and **Reject…**, then the link **Show on People**.
  - **Notes:**

- [ ] `9BE7` Select **Show on People**.
  - **Expected:**
    - The **People** page opens.
    - The details of 'Silje Holm-Schrøder' are open beside the table.
  - **Notes:**

- [ ] `26F0` Select the browser's Back button.
  - **Expected:**
    - The **Drafts** page shows, with only the row of 'Silje Holm-Schrøder'.
    - Her draft's details are open beside the table.
  - **Notes:**

- [ ] `D29F` Clear the search box.
  - **Expected:**
    - The other drafts to decide are shown again.
    - The details of 'Silje Holm-Schrøder' stay open.
  - **Notes:**

- [ ] `B9A7` Select **All drafts** beside the page's title.
  - **Expected:** **All drafts** is chosen.
  - **Notes:**

- [ ] `53B1` Search for `Harbourside`.
  - **Expected:** A row's **Record** reads 'Harbourside in Sites', after a red dot in a ring.
  - **Notes:**

- [ ] `5374` Select the details button of that row.
  - **Expected:**
    - **State** reads "Rejected".
    - **Reason** reads "Fictional reason: leave Positions and Sites as they are until both are reviewed."
    - Under **Waiting on it**, **Draft** reads "the new order for Sites".
    - There are no **Approve…** or **Reject…** buttons.
    - A dimmed line reads "Back with Engineering Operations Manager to change and resubmit."
    - Under it comes the link **Show on Lists**.
  - **Notes:**

- [ ] `D238` Press Esc.
  - **Expected:**
    - The details panel closes.
    - The **Record** cell of 'Harbourside in Sites' has focus.
  - **Notes:**

### DRAFT-30: Not Published Shows One's Own Unpublished Changes

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-29.

**Preconditions:** Signed in with this account. **Drafts** page open from the left-hand menu.

- [ ] `A627` Read the tabs beside the page's title.
  - **Expected:**
    - **Not published** comes first, chosen, followed by a dimmed 3.
    - **All drafts** comes second.
    - There is no **To decide** tab.
  - **Notes:**

- [ ] `191C` Read the table.
  - **Expected:**
    - Three rows are shown, whose **Record** reads 'Laptop in Equipment', 'Equipment' and 'Mariana Metz', each after a hollow yellow dot.
    - Each row's **State** reads "Not published".
  - **Notes:**

- [ ] `6CC0` Select the details button of the row of 'Equipment'.
  - **Expected:**
    - The details panel's title reads 'Equipment', after a hollow yellow dot.
    - Under **Linked to**, **Change** reads 'Laptop in Equipment', as a link.
    - A dimmed line reads "Nobody else sees these changes until they're published."
    - Under it comes the link **Show on Lists**.
  - **Notes:**

### DRAFT-31: Changes That Depend on Each Other Are Published Together, and a Change Is Discarded

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account DRAFT-30 ended with.

**Preconditions:** DRAFT-30 done. **Drafts** page open, on **Not published**, with no details panel open.

- [ ] `1F4C` Tick the row of 'Laptop in Equipment'.
  - **Expected:**
    - The rows of 'Equipment' and 'Laptop in Equipment' are both ticked.
    - At the right of the page's heading: **Discard 2 changes…** and **Publish 2 changes**.
  - **Notes:**

- [ ] `D3B5` Select **Publish 2 changes**.
  - **Expected:**
    - A notice reads "Published 2 changes."
    - The table shows one row, 'Mariana Metz'.
    - **Not published** is followed by a dimmed 1.
    - The top bar reads **Publish 1 change**.
  - **Notes:**

- [ ] `0837` Tick the row of 'Mariana Metz'.
  - **Expected:**
    - Her row is ticked.
    - At the right of the page's heading: **Discard 1 change…** and **Publish 1 change**.
  - **Notes:**

- [ ] `6CE5` Select **Discard 1 change…**.
  - **Expected:**
    - A dialog titled "Discard 1 change?" opens.
    - It reads "The chosen change is discarded. This cannot be undone."
  - **Notes:**

- [ ] `4A43` Select **Discard** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice reads "Discarded 1 change."
    - The table reads "No drafts".
    - **Not published** is followed by a dimmed 0.
    - The top bar has no **Publish** button.
  - **Notes:**

- [ ] `80E4` Select **All drafts**.
  - **Expected:** Rows for 'Equipment' and 'Laptop in Equipment' are listed, each after a solid yellow dot.
  - **Notes:**

### DRAFT-20: All Waiting Drafts Can Be Approved From the Drafts Page

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from DRAFT-31.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **Drafts** page open from the left-hand menu.

- [ ] `DDAC` Tick the tick box before **Record** in the table's header.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 32 drafts…**.
  - **Notes:**

- [ ] `30E7` Select **Approve 32 drafts…**.
  - **Expected:** A dialog titled "Approve 32 drafts?" opens.
  - **Notes:**

- [ ] `EA4D` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice reads "Approved 32 drafts."
    - No buttons at the right of the page's heading.
  - **Notes:**

**Afterwards:** Run Reset the Database.
