---
title: "Manual Test: Metrics, Frozen Columns, and Column Widths on the People Table"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/views.ts", "packages/shared/src/views.ts"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-07"
---

# Manual Test: Metrics, Frozen Columns, and Column Widths on the People Table

## Scope

Verifies the People table's Metrics panel: breaking people down by one column or two, following the filters and the Draft menu, resizing the panel, and keeping metrics in saved views. Also verifies that frozen columns stay in view while the table scrolls sideways, and that columns are made wider and narrower, in light and dark mode.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser whose window can be made narrower than 768 pixels.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1 and R2).

## Test Accounts

R1 creates this account, with every other development account, so it exists once R1 has run. The accounts share one password, which R1 prints when it finishes. Each account must hold its role as Fathom starts it: if any role has been changed on the **Roles** page, reset the database (R2) before the first test case, since restoring the seed data (R1) does not put roles back.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at the address the terminal prints, such as `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use after R0, before the first test case, and wherever a test case says so. Fathom keeps running. This removes the seed data and every draft of it, including drafts made during the test, then adds the seed data again; it keeps accounts, saved views and anything else added by hand.

1. In the second terminal, run:

   ```sh
   pnpm db:reseed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

### R2: Reset the Database

Use only where this test says so. This deletes every account and record in the development database, including anything added by hand, and puts every role back as Fathom starts it. Ask the owner before running it on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Start Fathom again (R0).

### P1: Show Live Only

1. Select the **Draft** button above the table, next to the search box.
2. Select **Live only**.
3. Press Esc to close the menu.

## Terms

- **Metrics panel:** the panel titled **Metrics** that opens on the right of the People table.
- **Count line:** the line under the panel's title saying how many people and planned hires it counts, such as **150 people and 8 planned hires**.
- **Draft menu:** the menu that opens from the **Draft** button above the table, next to the search box.
- **Views menu:** the menu that opens from the **Views** button, the last of the buttons after the search box.
- **Column menu:** the menu that opens when you select a column's name in the People table's header.
- **Panel edge:** the strip between the table and the Metrics panel. A blue line shows on it when the pointer is over it.
- **Column edge:** the right edge of a column's name in the People table's header. A short blue line shows on it when the pointer is over it.
- **Details button:** the small button with an arrow out of a box at the right end of a person's **Name** cell, shown while the pointer is over their row.
- **Appearance menu:** the **Appearance** items in the account menu, which opens from the account button at the top right, showing the account's name.

## Test Cases

Run the test cases in order. Start with R0, then R1, then sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`. Check each step whose expected result you see, and write anything else under its notes.

### METRICS-01: The Panel Opens and Closes

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** **People** page open from the left-hand menu.

- [ ] **Step 1.** Select **Metrics** above the table.
  - **Expected:** The Metrics panel opens on the right, and the table narrows beside it. The panel has **Break down by** set to **Choose a column**, and says **Choose a column to count people and planned hires by its values.**
  - **Notes:**

- [ ] **Step 2.** Press Esc.
  - **Expected:** The panel closes, and the **Metrics** button has the keyboard focus.
  - **Notes:**

- [ ] **Step 3.** Open the **Position** column menu, and select **Break down by**.
  - **Expected:** The panel opens with **Break down by** set to **Position**, showing a row for each position.
  - **Notes:**

- [ ] **Step 4.** Open the **Name** column menu.
  - **Expected:** The menu has no **Break down by**.
  - **Notes:**

### METRICS-02: One Column Is Counted With Shares

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-01.

**Preconditions:** **People** page open. Live only shown (P1).

- [ ] **Step 1.** Select **Metrics**, then set **Break down by** to **Position**.
  - **Expected:** The count line says **150 people and 8 planned hires**. The figures are headed **Count**. The rows are Employee 0 (0%), Manager 0 (0%), Software Engineer 73 (46.2%), Test Engineer 36 (22.8%), SDET 32 (20.3%), Engineering Manager 17 (10.8%) and Architect 0 (0%). No row shows **Live**.
  - **Notes:**

### METRICS-03: Two Columns Are Crossed

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-02.

**Preconditions:** As METRICS-02, with the panel open.

- [ ] **Step 1.** Set **Break down by** to **Position**, then **and by** to **Site**.
  - **Expected:** A table headed **Position by Site** has a column for each site and an **All** column, and a row for each position and an **All** row. An **Empty** column counts the planned hires, which have no site. The **All** row shows Kestrel Bay 31, Northmere 33, Ashgrove 47, Corran Quay 39, Empty 8 and All 158. **Count** is selected above the table.
  - **Notes:**

### METRICS-04: Metrics Follow the Filters

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-03.

**Preconditions:** As METRICS-02, with **Break down by** set to **Position**.

- [ ] **Step 1.** Open the **Site** column menu, select **Filter…**, and pick only **Ashgrove**. Press Esc.
  - **Expected:** The bar above the table says **47 of 158**. The count line says **47 people**. The rows are Employee 0 (0%), Manager 0 (0%), Software Engineer 20 (42.6%), Test Engineer 12 (25.5%), SDET 6 (12.8%), Engineering Manager 9 (19.1%) and Architect 0 (0%).
  - **Notes:**

- [ ] **Step 2.** Select **Clear all** in the bar above the table.
  - **Expected:** The filter is cleared, and the panel stays open.
  - **Notes:**

### METRICS-05: Metrics Show Live Figures Beside Drafts

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-04.

**Preconditions:** **People** page open. Metrics panel open.

- [ ] **Step 1.** Open the Draft menu, select **Drafts beside live**, and press Esc. Set **Break down by** to **Grade**, and **and by** to **Nothing more**.
  - **Expected:** The **P1** row shows a count with a dimmed **Live 17** under it. Rows whose count drafts do not change show no **Live** figure.
  - **Notes:**

### METRICS-06: The Panel Is Resized

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-05.

**Preconditions:** **People** page open, with the Metrics panel open.

- [ ] **Step 1.** Drag the panel edge to the left.
  - **Expected:** The panel widens and the table narrows as you drag.
  - **Notes:**

- [ ] **Step 2.** Select the **Metrics** title at the top of the panel, press Shift+Tab once, then press the Right arrow key three times.
  - **Expected:** A blue line shows on the panel edge, and the panel narrows a little with each press.
  - **Notes:**

- [ ] **Step 3.** Reload the page.
  - **Expected:** The panel opens again at the width it was left.
  - **Notes:**

### METRICS-07: Metrics Are Kept in Saved Views

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-06.

**Preconditions:** **People** page open. Live only shown (P1). Metrics panel open, with **Break down by** set to **Position** and **and by** to **Site**.

- [ ] **Step 1.** Open the Views menu, select **Save view…**, type `Fictional positions by site`, and select **Save view**.
  - **Expected:** The Views button is named **Fictional positions by site**.
  - **Notes:**

- [ ] **Step 2.** Open the Views menu and select **Clear view**.
  - **Expected:** The Metrics panel closes, and the table shows drafts beside live again.
  - **Notes:**

- [ ] **Step 3.** Open the Views menu and select **Fictional positions by site**.
  - **Expected:** The Metrics panel opens with **Position by Site**, live only, as in METRICS-03 step 1.
  - **Notes:**

- [ ] **Step 4.** Open the Views menu, select **Delete view**, and confirm the notice at the top right appears.
  - **Expected:** The view is gone from the Views menu.
  - **Notes:**

### METRICS-08: The Panel Covers a Narrow Screen

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-07.

**Preconditions:** **People** page open, with the Metrics panel open.

- [ ] **Step 1.** Make the browser window narrower than 768 pixels.
  - **Expected:** The panel covers the page below the top bar, and the panel edge is gone.
  - **Notes:**

- [ ] **Step 2.** Press Tab repeatedly.
  - **Expected:** The focus moves only among the panel's controls, never to the table behind it.
  - **Notes:**

### METRICS-09: Frozen Columns Stay in View While the Table Scrolls Sideways

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-08.

**Preconditions:** Browser window at least 1,440 pixels wide. **People** page open from the left-hand menu, with the Metrics panel closed. In the Appearance menu, **Light** selected.

- [ ] **Step 1.** Look at the right edge of the **Name** column, then scroll the table sideways to the right.
  - **Expected:** A thin grey line runs down the right edge of **Name**, header included. As the table scrolls, the other columns pass under **Name**, which stays in place, and a soft shadow shows to the right of the line.
  - **Notes:**

- [ ] **Step 2.** Scroll back to the left. Open the **ID** column menu and select **Freeze up to this column**.
  - **Expected:** The line moves to the right edge of **ID**.
  - **Notes:**

- [ ] **Step 3.** Scroll the table sideways to the right, then down.
  - **Expected:** **Name** and **ID** stay in place, with the shadow beside it, and the header row stays at the top. Rows tinted blue or yellow for a draft keep their tint in the frozen columns.
  - **Notes:**

- [ ] **Step 4.** In the Appearance menu, select **Dark**, then repeat step 3.
  - **Expected:** The frozen columns are dark, with nothing from the columns underneath showing through, and the line and shadow are visible.
  - **Notes:**

- [ ] **Step 5.** Scroll back to the left. Open the menu of the column furthest to the right.
  - **Expected:** **Freeze up to this column** is greyed out and cannot be selected.
  - **Notes:**

- [ ] **Step 6.** Press Esc. Drag the **Site** column's name onto the **Name** column's name.
  - **Expected:** **Site** moves before **Name**, and stays in place with the other frozen columns when the table scrolls sideways.
  - **Notes:**

- [ ] **Step 7.** Open the **ID** column menu and select **Unfreeze columns**. Scroll the table sideways and back, then open **Views**.
  - **Expected:** No column stays in place when the table scrolls sideways. The menu shows **Unfrozen** with an **×**, set apart from the items around it.
  - **Notes:**

- [ ] **Step 8.** Select **Unfrozen**. In the Appearance menu, select **Light**.
  - **Expected:** Only the first column stays in place again.
  - **Notes:**

**Afterwards:** Open **Views** and select **Columns moved**, which puts the columns back.

### METRICS-10: Columns Are Made Wider and Narrower

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as METRICS-09.

**Preconditions:** Browser window at least 1,440 pixels wide. **People** page open, with the Metrics panel closed. In the Appearance menu, **Light** selected.

- [ ] **Step 1.** Point at the column edge of **Name**, then drag it to the left as far as it goes.
  - **Expected:** A short blue line shows on the edge. **Name** narrows smoothly with the pointer and stops at about five characters wide. Names that no longer fit end in **…**, and every row stays one line tall.
  - **Notes:**

- [ ] **Step 2.** Point at a person's row.
  - **Expected:** The details button shows at the right end of their **Name** cell, and the name stops short of it, ending in **…**. The row stays one line tall.
  - **Notes:**

- [ ] **Step 3.** Drag the column edge of **Name** to the right as far as it goes.
  - **Expected:** **Name** widens with the pointer and stops when it takes about half the table's width.
  - **Notes:**

- [ ] **Step 4.** Look at the **Onboarding** column, then drag its column edge to the right by about the width of the column.
  - **Expected:** Before the drag, **Onboarding** is about 15 characters wide, each note cut short with **…**. After it, more of each note shows.
  - **Notes:**

- [ ] **Step 5.** Select the **ID** column's name, press Esc, then press Shift+Alt+Right arrow three times (Shift+Option+Right arrow on a Mac).
  - **Expected:** **ID** widens a little with each press and stays where it is.
  - **Notes:**

- [ ] **Step 6.** Open the **Site** column menu.
  - **Expected:** Lines split the menu into groups: the two sorts; **Filter…** and **Break down by**; **Freeze up to this column**, **Wider**, and **Narrower**; then **Edit column**, **Move left**, and **Move right**.
  - **Notes:**

- [ ] **Step 7.** Press Esc. In the Appearance menu, select **Dark**, then point at the column edge of **Site**.
  - **Expected:** The blue line shows clearly on the edge.
  - **Notes:**

- [ ] **Step 8.** Open the Views menu.
  - **Expected:** The menu shows **Widths: Name, ID, Onboarding** with an **×**, set apart from the items around it.
  - **Notes:**

- [ ] **Step 9.** Select **Widths: Name, ID, Onboarding**. In the Appearance menu, select **Light**.
  - **Expected:** **Name**, **ID**, and **Onboarding** go back to the widths they had at the start of this test case.
  - **Notes:**
