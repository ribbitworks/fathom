---
title: "Manual Test: Acceptance, Work Between Roles"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/acceptance/acceptance-setting-up-fathom-manual-test.md", "docs/help/how-work-moves-between-roles.md", "docs/product/roles.md"]
last_updated: "2026-11-17"
---

# Manual Test: Acceptance, Work Between Roles

## Scope

Verifies that work passes from one role to the next as [How Work Moves Between Roles](../../help/how-work-moves-between-roles.md) describes: a Product Manager drafts a project and a feature with its cycle and team, the Engineering Director approves them, and an Engineering Manager staffs the feature teams, from next month and months ahead, for approval, on the people and teams [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) has just set up. It also verifies that the org chart and Feature assignments show each team month by month.

## Test Environment

As [Manual Test Basics](../manual-test-basics.md#test-environment) sets out, with a browser window at least 1,440 pixels wide.

## Test Accounts

As [Manual Test Basics](../manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Engineering Director:** `engineering.director@fathom.test`
- **Engineering Manager:** `engineering.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`

## Common Procedures

This test uses [Reset the Database](../manual-test-basics.md#reset-the-database) and [Publish](../manual-test-basics.md#publish).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Publish button, the teams switch, the team panel and the team list. This test adds:

- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20260501`.
- **Months from today:** the steps name months by where they fall from the current month: **next month** is the one after it, **six months ago** the sixth month before it, **seven months ago** the seventh, and **two months from now** and **three months from now** the second and third months after it. The examples after "such as" are for a run in November 2026, such as `20260501` for the first day of six months ago.
- **Next year's first cycle:** the first cycle [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) sets up, named by the last two digits of the year after the current one and `.1`, such as "27.1" in a run in 2026.
- **Empty row:** the row at the end of a table, with blank cells, where a new record is typed.
- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**.

## Test Cases

Run the test cases in order, in about 30 minutes, straight after [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md), without restoring or resetting the data. Check each step whose expected result you see, and write anything else under its notes.

### WORK-01: A Product Manager Drafts a Project and Its Feature

**Account:** Product Manager, `product.manager@fathom.test`, changed from SETUP-09 in [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md); the first test case.

**Preconditions:** [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) run just before. Signed in with this account.

- [ ] `D681` Select the **Projects** page in the left-hand menu.
  - **Expected:**
    - The **Projects** tab is chosen.
    - The table has only its empty row.
    - The count above it reads "0 projects".
  - **Notes:**

- [ ] `1B6E` Select **New project**.
  - **Expected:** The side panel opens, headed **New project**.
  - **Notes:**

- [ ] `F879` Type `Fictional Lamp Room` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `0B37` Type `FLR-1` in **Project ID**.
  - **Expected:** **Project ID** shows what was typed.
  - **Notes:**

- [ ] `B848` Select the change button in the **Owner** row, and pick `Ada Quill`.
  - **Expected:** **Owner** shows `Ada Quill`.
  - **Notes:**

- [ ] `F0FE` Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before `Fictional Lamp Room`.
    - Under **Milestones**, it reads "None".
  - **Notes:**

- [ ] `94DB` Select the **Features** page in the left-hand menu.
  - **Expected:**
    - The table has no group headings.
    - The table has only its empty row.
    - The count above it reads "0 features".
  - **Notes:**

- [ ] `DC9C` Select **New feature**.
  - **Expected:** The **New feature** panel opens beside the table.
  - **Notes:**

- [ ] `5EB4` Type `Fictional Tide Tables` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `958E` Select the change button in the **Status** row, and choose **Planned**.
  - **Expected:** **Status** shows "Planned".
  - **Notes:**

- [ ] `1ABE` Select the change button in the **Target cycle** row, and choose **Fictional Mainline:** followed by next year's first cycle, such as **Fictional Mainline: 27.1**.
  - **Expected:** **Target cycle** shows the cycle chosen, such as "Fictional Mainline: 27.1".
  - **Notes:**

- [ ] `D628` Select the change button in the **Feature team** row, and choose `Tide team`.
  - **Expected:** **Feature team** shows `Tide team`.
  - **Notes:**

- [ ] `7B69` Select **Add**.
  - **Expected:**
    - The feature's details are headed with a hollow yellow dot before `Fictional Tide Tables`.
    - In the table, its **Feature team** cell reads `Tide team`, and does not show **No team**.
    - Its **Target cycle** cell reads the cycle chosen, such as "Fictional Mainline: 27.1".
  - **Notes:**

- [ ] `B542` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens, with `Fictional Lamp Room` listed.
  - **Notes:**

- [ ] `6C21` Select the **Features** cell of `Fictional Lamp Room`, press Enter, type `Tide`, press Enter, and press Enter again.
  - **Expected:** The **Features** cell names `Fictional Tide Tables`.
  - **Notes:**

- [ ] `47DB` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

### WORK-02: The Engineering Director Approves the Drafts

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from WORK-01.

**Preconditions:** WORK-01 done. Signed in with this account.

- [ ] `6C42` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - Two rows are shown, each with a tick box, whose **Record** reads:
      - `FLR-1 Fictional Lamp Room`, with **Type** "Project"
      - `Fictional Tide Tables`, with **Type** "Feature"
  - **Notes:**

- [ ] `6CFD` Tick the tick box before **Record** in the table's header.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 2 drafts…**.
  - **Notes:**

- [ ] `655C` Select **Approve 2 drafts…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 2 drafts?" opens.
  - **Notes:**

- [ ] `5BB4` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 2 drafts."
    - The table reads "No drafts".
  - **Notes:**

- [ ] `5CC2` Select the **Features** page in the left-hand menu.
  - **Expected:**
    - `Fictional Tide Tables` is under the heading of that cycle, such as **Fictional Mainline: 27.1**.
    - It has no dot.
    - It reads `Tide team` in **Feature team**.
  - **Notes:**

### WORK-03: An Engineering Manager Plans Team Changes Months Ahead

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from WORK-02. Step `4FF5` signs in as another account.

**Preconditions:** WORK-02 done. Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] `727D` Select the right arrow once.
  - **Expected:** Text below the row reads "Showing" with the first day of next month, such as "Showing Dec 1, 2026.", then "Changes take effect from this date."
  - **Notes:**

- [ ] `CB84` Select the Feature teams button, then `Tide team`.
  - **Expected:** The team panel is titled `Tide team`.
  - **Notes:**

- [ ] `FA46` Select the change button in the **Feature lead** row, type `Ada`, and press Enter.
  - **Expected:**
    - **Feature lead** reads `Ada Quill`, with a hollow yellow dot before it.
    - Under it, a green dot before "None", in grey.
  - **Notes:**

- [ ] `DD2C` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `875E` Type `Bram`, and press Enter to untick `Bram Oakes`.
  - **Expected:** `Bram Oakes` has no tick.
  - **Notes:**

- [ ] `682E` Press Enter.
  - **Expected:**
    - **Members** lists `Ada Quill`, `Bram Oakes` and `Cleo Marsh`.
    - A hollow yellow dot is before `Bram Oakes`.
    - `Bram Oakes` is struck through.
  - **Notes:**

- [ ] `93A3` Select the Feature teams button, then `Harbour team`.
  - **Expected:** The team panel is titled `Harbour team`.
  - **Notes:**

- [ ] `4D92` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `07F8` Type `Bram`, and press Enter.
  - **Expected:** `Bram Oakes` has a tick.
  - **Notes:**

- [ ] `4AA0` Press Enter.
  - **Expected:**
    - **Members** lists `Bram Oakes`.
    - A hollow yellow dot is before his name.
  - **Notes:**

- [ ] `77F5` Select the right arrow twice.
  - **Expected:** Text below the row reads "Showing" with the first day of the month three months from now, such as "Showing Feb 1, 2027."
  - **Notes:**

- [ ] `4C70` Select the Feature teams button, then `Beacon team`.
  - **Expected:** The team panel is titled `Beacon team`.
  - **Notes:**

- [ ] `111D` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `F3EA` Type `Cleo`, and press Enter to untick `Cleo Marsh`.
  - **Expected:** `Cleo Marsh` has no tick.
  - **Notes:**

- [ ] `A5DD` Type `Freya`, and press Enter to untick `Freya Holt`.
  - **Expected:** `Freya Holt` has no tick.
  - **Notes:**

- [ ] `B494` Press Enter.
  - **Expected:**
    - **Members** lists `Cleo Marsh` and `Freya Holt`.
    - Each has a hollow yellow dot before the name.
    - Each name is struck through.
  - **Notes:**

- [ ] `44D9` Select **Today**.
  - **Expected:** The text below the row is gone.
  - **Notes:**

- [ ] `832C` Select the Feature teams button, then `Tide team`.
  - **Expected:**
    - In the **Members** row, `Bram Oakes` has a hollow yellow dot before his name.
    - His name is struck through.
    - It is followed in grey by "from" and the first day of next month.
  - **Notes:**

- [ ] `C869` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `4FF5` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `B822` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `2ED1` Tick the tick box before **Record** in the table's header.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 3 drafts…**.
  - **Notes:**

- [ ] `9D85` Select **Approve 3 drafts…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 3 drafts?" opens.
  - **Notes:**

- [ ] `4BC8` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 3 drafts."
  - **Notes:**

### WORK-04: The Org Chart Shows Each Team Month by Month

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from WORK-03.

**Preconditions:** WORK-03 done. Signed in with this account. **Org chart** page open, with **Feature teams** chosen in the teams switch, showing today.

- [ ] `C7EE` Read the chart.
  - **Expected:**
    - A card named `Tide team` reads "No feature lead", with `Ada Quill`, `Bram Oakes` and `Cleo Marsh` under it.
    - `Dara Finch`'s card is named `Harbour team`, with `Emil Stone` under it.
    - A card named `Beacon team` reads "No feature lead", with `Cleo Marsh` and `Freya Holt` under it.
  - **Notes:**

- [ ] `416A` Clear the date box, type the first day of six months ago, such as `20260501`, and press Enter.
  - **Expected:**
    - Below the row, text reads "Showing" and that day, such as "Showing May 1, 2026.", then "Changes take effect from this date."
    - A card named `Tide team` reads "No feature lead", with `Ada Quill`, `Bram Oakes` and `Cleo Marsh` under it.
    - `Dara Finch`'s card is named `Harbour team`, with `Emil Stone` under it.
    - A card named `Beacon team` reads "No feature lead", with `Cleo Marsh` and `Freya Holt` under it.
  - **Notes:**

- [ ] `D0FA` Select **Today**.
  - **Expected:** The text below the row is gone.
  - **Notes:**

- [ ] `6FD2` Select the right arrow once.
  - **Expected:**
    - The date box shows the first day of next month.
    - `Ada Quill`'s card is named `Tide team`, with `Cleo Marsh` under it.
    - `Dara Finch`'s card is named `Harbour team`, with `Bram Oakes` and `Emil Stone` under it.
    - A card named `Beacon team` reads "No feature lead", with `Cleo Marsh` and `Freya Holt` under it.
  - **Notes:**

- [ ] `C1B6` Select the right arrow twice.
  - **Expected:**
    - The date box shows the first day of three months from now.
    - Only `Tide team` and `Harbour team` are drawn.
    - No card names `Beacon team`.
  - **Notes:**

- [ ] `F071` Select **Today**.
  - **Expected:**
    - The text below the row goes.
    - A card named `Tide team` reads "No feature lead", with `Ada Quill`, `Bram Oakes` and `Cleo Marsh` under it.
    - `Dara Finch`'s card is named `Harbour team`, with `Emil Stone` under it.
    - A card named `Beacon team` reads "No feature lead", with `Cleo Marsh` and `Freya Holt` under it.
  - **Notes:**

### WORK-05: Feature Assignments Show the Changes by Month

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as WORK-04.

**Preconditions:** WORK-03 done.

- [ ] `29AD` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The page is headed **Feature assignments**.
  - **Notes:**

- [ ] `CCDB` Select **Feature team** in the Group by menu.
  - **Expected:**
    - The groups are `Beacon team`, `Harbour team`, `Tide team` and **No feature team**, in that order.
    - `Odile Brandt` is under **No feature team**.
  - **Notes:**

- [ ] `02FA` Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens.
  - **Notes:**

- [ ] `D453` Type `Bram`.
  - **Expected:** Only `Bram Oakes`'s rows are listed.
  - **Notes:**

- [ ] `A799` Press Esc.
  - **Expected:**
    - `Bram Oakes` is listed under `Harbour team` and under `Tide team`.
    - In each of his rows, the current month's cell holds a `Tide team` label.
    - In each of his rows, next month's cell holds a `Harbour team` label.
  - **Notes:**

- [ ] `5C18` Scroll the table to the left until the column for seven months ago is in view, and read one of `Bram Oakes`'s rows from left to right.
  - **Expected:**
    - The cell for seven months ago holds no label.
    - From six months ago to the current month, each cell holds a `Tide team` label.
    - From next month on, each holds a `Harbour team` label.
  - **Notes:**

- [ ] `1FE3` Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens, holding `Bram`.
  - **Notes:**

- [ ] `243F` Replace `Bram` with `Cleo`.
  - **Expected:** Only `Cleo Marsh`'s rows are listed.
  - **Notes:**

- [ ] `1D95` Press Esc, and read `Cleo Marsh`'s rows from left to right.
  - **Expected:**
    - From six months ago to two months from now, `Cleo Marsh`'s cells hold a `Beacon team` label and a `Tide team` label.
    - From three months from now on, `Cleo Marsh`'s cells hold only `Tide team`.
  - **Notes:**

- [ ] `AB3B` Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens, holding `Cleo`.
  - **Notes:**

- [ ] `330C` Replace `Cleo` with `Freya`.
  - **Expected:** Only `Freya Holt`'s rows are listed.
  - **Notes:**

- [ ] `C6BD` Press Esc, and read `Freya Holt`'s rows from left to right.
  - **Expected:**
    - `Freya Holt`'s cells hold a `Beacon team` label from six months ago to two months from now.
    - `Freya Holt`'s cells hold no label from three months from now on.
  - **Notes:**

### WORK-06: An Engineering Manager Staffs a Team From Next Month for Approval

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as WORK-05. Step `53D3` signs in as another account.

**Preconditions:** WORK-05 done. **Feature assignments** page open, with the **Person** filter holding `Freya`.

- [ ] `D422` Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens, holding `Freya`.
  - **Notes:**

- [ ] `565D` Replace `Freya` with `Odile`.
  - **Expected:**
    - Only `Odile Brandt`'s row is listed.
    - No cell in it holds a label.
  - **Notes:**

- [ ] `8E61` Press Esc.
  - **Expected:** The filter closes.
  - **Notes:**

- [ ] `2EE0` Select `Odile Brandt`'s cell for next month, and press Enter.
  - **Expected:** The team list opens under the cell.
  - **Notes:**

- [ ] `65F1` Type `Harbour`, and press Tab.
  - **Expected:**
    - The team list closes.
    - From next month on, each cell holds a `Harbour team` label with a hollow yellow dot before it.
    - The current month's cell holds no label.
  - **Notes:**

- [ ] `B619` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `53D3` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `7B0E` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - One row is shown, whose **Record** reads `Harbour team`, with **Type** "Feature team".
    - Its **What changes** adds "Odile Brandt" to **Members**.
    - Its **Made by** reads "Engineering Manager as Engineering Manager".
  - **Notes:**

- [ ] `1C0E` Tick the tick box before **Record** in the table's header.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `AF6E` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `4C25` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 1 draft."
    - The table reads "No drafts".
  - **Notes:**

- [ ] `0B5F` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The page is headed **Feature assignments**.
  - **Notes:**

- [ ] `3ACA` Type `Odile` in the search box.
  - **Expected:**
    - Only `Odile Brandt`'s row is listed.
    - From next month on, each cell holds a `Harbour team` label with no dot.
  - **Notes:**

**Afterwards:** Run Reset the Database.
