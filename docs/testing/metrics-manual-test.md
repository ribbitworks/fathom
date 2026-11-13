---
title: "Manual Test: Metrics, Frozen Columns, and Column Widths on the People Table"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/views.ts", "packages/shared/src/views.ts"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-13"
---

# Manual Test: Metrics, Frozen Columns, and Column Widths on the People Table

## Scope

Verifies the People table's Metrics panel: breaking people down by one column or two, following the filters and the Draft menu, resizing the panel, and keeping metrics in saved views. Also verifies that frozen columns stay in view while the table scrolls sideways, and that columns are made wider and narrower, in light and dark mode.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A browser window that can be made narrower than 768 pixels.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), and one of its own.

### Show Live Only

1. Select the **Draft** button above the table, next to the search box.
2. Select **Live only**.
3. Press Esc to close the menu.

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Appearance menu, the Draft menu and the column menu. This test adds:

- **Metrics panel:** the panel titled **Metrics** that opens on the right of the People table.
- **Count line:** the line under the panel's title saying how many people and planned hires it counts, such as **150 people and 8 planned hires**.
- **Panel edge:** the strip between the table and the Metrics panel. A blue line shows on it when the pointer is over it.
- **Column edge:** the right edge of a column's name in the People table's header. A short blue line shows on it when the pointer is over it.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data, then sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### METRICS-01: The Panel Opens and Closes

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** **People** page open from the left-hand menu.

- [ ] **Step 1.** Select **Metrics** above the table.
  - **Expected:**
    - The Metrics panel opens on the right.
    - The table narrows beside it.
    - **Break down by** reads **Choose a column**.
  - **Notes:**

- [ ] **Step 2.** Press Esc.
  - **Expected:**
    - The panel closes.
    - The **Metrics** button has the keyboard focus.
  - **Notes:**

- [ ] **Step 3.** Open the **Position** column menu, and select **Break down by**.
  - **Expected:**
    - The panel opens.
    - **Break down by** is set to **Position**.
    - It shows a row for each position.
  - **Notes:**

- [ ] **Step 4.** Open the **Name** column menu.
  - **Expected:** The menu has no **Break down by**.
  - **Notes:**

### METRICS-02: One Column Is Counted With Shares

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-01.

**Preconditions:** **People** page open. Live only shown: run Show Live Only.

- [ ] **Step 1.** Select **Metrics**.
  - **Expected:** The Metrics panel opens.
  - **Notes:**

- [ ] **Step 2.** Set **Break down by** to **Position**.
  - **Expected:**
    - The count line says **150 people and 8 planned hires**.
    - The figures are headed **Count**.
    - The rows read, from top to bottom:
      - Employee 0 (0%)
      - Manager 0 (0%)
      - Software Engineer 73 (46.2%)
      - Test Engineer 36 (22.8%)
      - SDET 32 (20.3%)
      - Engineering Manager 17 (10.8%)
      - Architect 0 (0%)
    - No row shows a green dot and a second figure.
  - **Notes:**

### METRICS-03: Two Columns Are Crossed

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-02.

**Preconditions:** As METRICS-02, with the panel open.

- [ ] **Step 1.** Set **Break down by** to **Position**.
  - **Expected:** **Break down by** reads **Position**.
  - **Notes:**

- [ ] **Step 2.** Set **and by** to **Site**.
  - **Expected:**
    - A table headed **Position by Site** shows.
    - It has a column for each site and an **All** column.
    - It has a row for each position and an **All** row.
    - An **Empty** column counts the planned hires, which have no site.
    - The **All** row shows:
      - Kestrel Bay 31
      - Northmere 33
      - Ashgrove 47
      - Corran Quay 39
      - Empty 8
      - All 158
    - **Count** is selected above the table.
  - **Notes:**

### METRICS-04: Metrics Follow the Filters

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-03.

**Preconditions:** As METRICS-02, with **Break down by** set to **Position**.

- [ ] **Step 1.** Open the **Site** column menu, and select **Filter…**.
  - **Expected:**
    - The filter opens.
    - It lists the sites.
  - **Notes:**

- [ ] **Step 2.** Pick only **Ashgrove**.
  - **Expected:** **Ashgrove** is the only site picked.
  - **Notes:**

- [ ] **Step 3.** Press Esc.
  - **Expected:**
    - The filter closes.
    - The bar above the table says **47 of 158**.
    - The count line says **47 people**.
    - The rows read, from top to bottom:
      - Employee 0 (0%)
      - Manager 0 (0%)
      - Software Engineer 20 (42.6%)
      - Test Engineer 12 (25.5%)
      - SDET 6 (12.8%)
      - Engineering Manager 9 (19.1%)
      - Architect 0 (0%)
  - **Notes:**

- [ ] **Step 4.** Select **Clear all** in the bar above the table.
  - **Expected:**
    - The filter is cleared.
    - The panel stays open.
  - **Notes:**

### METRICS-05: Metrics Show Live Figures Beside Drafts

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-04.

**Preconditions:** **People** page open. Metrics panel open.

- [ ] **Step 1.** Open the Draft menu, and select **Drafts beside live**.
  - **Expected:**
    - The Draft menu stays open.
    - A tick is before **Drafts beside live**.
  - **Notes:**

- [ ] **Step 2.** Press Esc.
  - **Expected:** The Draft menu closes.
  - **Notes:**

- [ ] **Step 3.** Set **Break down by** to **Grade**.
  - **Expected:** **Break down by** reads **Grade**.
  - **Notes:**

- [ ] **Step 4.** Set **and by** to **Nothing more**.
  - **Expected:**
    - The **P1** row shows a count.
    - Under the count, a green dot before a dimmed **17**.
    - Rows whose count drafts do not change show no green dot.
  - **Notes:**

### METRICS-06: The Panel Is Resized

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-05.

**Preconditions:** **People** page open, with the Metrics panel open.

- [ ] **Step 1.** Drag the panel edge to the left.
  - **Expected:**
    - The panel widens with the pointer.
    - The table narrows with the pointer.
  - **Notes:**

- [ ] **Step 2.** Select the **Metrics** title at the top of the panel.
  - **Expected:**
    - The panel stays open.
    - Its width does not change.
  - **Notes:**

- [ ] **Step 3.** Press Shift+Tab once.
  - **Expected:** A blue line shows on the panel edge.
  - **Notes:**

- [ ] **Step 4.** Press the Right arrow key three times.
  - **Expected:** The panel narrows a little with each press.
  - **Notes:**

- [ ] **Step 5.** Reload the page.
  - **Expected:** The panel opens again at the width it was left.
  - **Notes:**

### METRICS-07: Metrics Are Kept in Saved Views

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-06.

**Preconditions:** **People** page open. Live only shown: run Show Live Only. Metrics panel open, with **Break down by** set to **Position** and **and by** to **Site**.

- [ ] **Step 1.** Open the Views menu, and select **Save view…**.
  - **Expected:** A dialog titled **Save view** opens.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional positions by site`.
  - **Expected:** The name box holds **Fictional positions by site**.
  - **Notes:**

- [ ] **Step 3.** Select **Save view**.
  - **Expected:** The Views button is named **Fictional positions by site**.
  - **Notes:**

- [ ] **Step 4.** Open the Views menu, and select **Clear view**.
  - **Expected:**
    - The Metrics panel closes.
    - The table shows drafts beside live again.
  - **Notes:**

- [ ] **Step 5.** Open the Views menu, and select **Fictional positions by site**.
  - **Expected:**
    - The Metrics panel opens.
    - It shows a table headed **Position by Site**.
    - The figures are live only: the **All** row ends with **All** 158.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu, and select **Delete view**.
  - **Expected:**
    - A notice at the top right reads **Deleted the Fictional positions by site view.**
    - It offers **Undo**.
  - **Notes:**

- [ ] **Step 7.** Open the Views menu.
  - **Expected:** The view is gone from the Views menu.
  - **Notes:**

### METRICS-08: The Panel Covers a Narrow Screen

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-07.

**Preconditions:** **People** page open, with the Metrics panel open.

- [ ] **Step 1.** Make the browser window narrower than 768 pixels.
  - **Expected:**
    - The panel covers the page below the top bar.
    - The panel edge is gone.
  - **Notes:**

- [ ] **Step 2.** Press Tab repeatedly.
  - **Expected:** The focus moves only among the panel's controls, never to the table behind it.
  - **Notes:**

### METRICS-09: Frozen Columns Stay in View While the Table Scrolls Sideways

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-08.

**Preconditions:** Browser window at least 1,440 pixels wide. **People** page open from the left-hand menu, with the Metrics panel closed. In the Appearance menu, **Light** selected.

- [ ] **Step 1.** Look at the right edge of the **Name** column.
  - **Expected:** A thin grey line runs down the right edge of **Name**, header included.
  - **Notes:**

- [ ] **Step 2.** Scroll the table sideways to the right.
  - **Expected:**
    - As the table scrolls, the other columns pass under **Name**, which stays in place.
    - A soft shadow shows to the right of the line.
  - **Notes:**

- [ ] **Step 3.** Scroll the table sideways back to the left.
  - **Expected:** The table is back at its first columns.
  - **Notes:**

- [ ] **Step 4.** Open the **ID** column menu, and select **Freeze up to this column**.
  - **Expected:** The line moves to the right edge of **ID**.
  - **Notes:**

- [ ] **Step 5.** Scroll the table sideways to the right.
  - **Expected:**
    - **Name** and **ID** stay in place.
    - The shadow is beside them.
  - **Notes:**

- [ ] **Step 6.** Scroll the table down.
  - **Expected:**
    - **Name** and **ID** stay in place.
    - The shadow is beside them.
    - The header row stays at the top.
    - Rows tinted faint yellow or faint red for a draft keep their tint in the frozen columns.
    - Each line between rows is one thin line running straight across the frozen columns into the others.
    - The dashed line between a draft row and its light green Live row is dashed all the way across.
  - **Notes:**

- [ ] **Step 7.** In the Appearance menu, select **Dark**.
  - **Expected:** The page turns dark.
  - **Notes:**

- [ ] **Step 8.** Scroll the table sideways back to the left.
  - **Expected:**
    - The frozen columns are dark.
    - Nothing from the columns underneath shows through.
    - The line and shadow are visible while the table scrolls.
  - **Notes:**

- [ ] **Step 9.** Open the menu of the column furthest to the right.
  - **Expected:** **Freeze up to this column** is greyed out and cannot be selected.
  - **Notes:**

- [ ] **Step 10.** Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 11.** Drag the **Site** column's name onto the **Name** column's name.
  - **Expected:** **Site** moves before **Name**.
  - **Notes:**

- [ ] **Step 12.** Scroll the table sideways to the right.
  - **Expected:** **Site**, **Name** and **ID** stay in place.
  - **Notes:**

- [ ] **Step 13.** Open the **ID** column menu, and select **Unfreeze columns**.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 14.** Scroll the table sideways back to the left.
  - **Expected:** No column stays in place as the table scrolls.
  - **Notes:**

- [ ] **Step 15.** Open **Views**.
  - **Expected:**
    - The menu shows **Unfrozen**.
    - **Unfrozen** has an **×**.
    - **Unfrozen** is set apart from the items around it.
  - **Notes:**

- [ ] **Step 16.** Select **Unfrozen**.
  - **Expected:** Only **Site**, now the first column, stays in place as the table scrolls.
  - **Notes:**

- [ ] **Step 17.** In the Appearance menu, select **Light**.
  - **Expected:** The page is light.
  - **Notes:**

**Afterwards:** Open **Views** and select **Columns moved**, which puts the columns back.

### METRICS-10: Columns Are Made Wider and Narrower

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-09.

**Preconditions:** Browser window at least 1,440 pixels wide. **People** page open, with the Metrics panel closed. In the Appearance menu, **Light** selected.

- [ ] **Step 1.** Point at the column edge of **Name**.
  - **Expected:** A short blue line shows on the edge.
  - **Notes:**

- [ ] **Step 2.** Drag the column edge of **Name** to the left as far as it goes.
  - **Expected:**
    - **Name** narrows smoothly with the pointer.
    - **Name** stops at about five characters wide.
    - Names that no longer fit end in **…**.
    - Every row stays one line tall.
  - **Notes:**

- [ ] **Step 3.** Point at a person's row.
  - **Expected:**
    - The details button shows at the right end of their **Name** cell.
    - The name stops short of it.
    - The name ends in **…**.
    - The row stays one line tall.
  - **Notes:**

- [ ] **Step 4.** Drag the column edge of **Name** to the right as far as it goes.
  - **Expected:**
    - **Name** widens with the pointer.
    - **Name** stops when it takes about half the table's width.
  - **Notes:**

- [ ] **Step 5.** Look at the **Onboarding** column.
  - **Expected:**
    - **Onboarding** is about 15 characters wide.
    - Each note is cut short with **…**.
  - **Notes:**

- [ ] **Step 6.** Drag the column edge of **Onboarding** to the right by about the width of the column.
  - **Expected:** More of each note shows.
  - **Notes:**

- [ ] **Step 7.** Select the **ID** column's name.
  - **Expected:** The **ID** column menu opens.
  - **Notes:**

- [ ] **Step 8.** Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 9.** Press Shift+Alt+Right arrow three times (Shift+Option+Right arrow on a Mac).
  - **Expected:**
    - **ID** widens a little with each press.
    - **ID** stays where it is.
  - **Notes:**

- [ ] **Step 10.** Open the **Site** column menu.
  - **Expected:** Lines split the menu into groups, from top to bottom:
    - the two sorts
    - **Filter…** and **Break down by**
    - **Freeze up to this column**, **Wider**, and **Narrower**
    - **Edit column**, **Move left**, and **Move right**
  - **Notes:**

- [ ] **Step 11.** Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 12.** In the Appearance menu, select **Dark**.
  - **Expected:** The page turns dark.
  - **Notes:**

- [ ] **Step 13.** Point at the column edge of **Site**.
  - **Expected:** The blue line shows clearly on the edge.
  - **Notes:**

- [ ] **Step 14.** Open the Views menu.
  - **Expected:**
    - The menu shows **Widths: Name, ID, Onboarding**.
    - **Widths: Name, ID, Onboarding** has an **×**.
    - **Widths: Name, ID, Onboarding** is set apart from the items around it.
  - **Notes:**

- [ ] **Step 15.** Select **Widths: Name, ID, Onboarding**.
  - **Expected:** **Name**, **ID**, and **Onboarding** go back to the widths they had at the start of this test case.
  - **Notes:**

- [ ] **Step 16.** In the Appearance menu, select **Light**.
  - **Expected:** The page is light.
  - **Notes:**
