---
title: "Manual Test: Metrics on the People Table"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/views.ts", "packages/shared/src/views.ts"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-03"
---

# Manual Test: Metrics on the People Table

## Scope

Verifies the People table's Metrics panel: breaking people down by one column or two, counts and shares, following the search, filters and Draft menu, resizing the panel, and keeping metrics in saved views.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser whose window can be made narrower than 768 pixels.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data command (R1).

## Test Accounts

R1 creates this account, with every other development account, so it exists once R1 has run. The accounts share one password, which R1 prints when it finishes.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It sees every column on People, including Start and End, and can save views.

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
   pnpm db:unseed && pnpm db:seed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

### P1: Sign In

1. If someone is signed in, sign out first (P2).
2. On the **Sign in** page, enter the account's email address and the shared password.
3. Select **Sign in**.

### P2: Sign Out

1. Select the account button at the top right, which shows the account's name.
2. Select **Sign out**.

### P3: Show Live Only

1. Select the **Draft** button above the table, next to the search box.
2. Select **Live only**.
3. Press Esc to close the menu.

## Terms

- **Metrics panel:** the panel titled **Metrics** that opens on the right of the People table.
- **Count line:** the line under the panel's title saying how many people it counts, such as **150 people**.
- **Draft menu:** the menu that opens from the **Draft** button above the table, next to the search box.
- **Views menu:** the menu that opens from the **Views** button, next to the search box.
- **Column menu:** the menu that opens when you select a column's name in the People table's header.
- **Panel edge:** the strip between the table and the Metrics panel. A blue line shows on it when the pointer is over it.

## Test Cases

Run the test cases in order. Start with R0, then R1, then sign in (P1) as `engineering.operations.manager@fathom.test`. Tick each step whose expected result you see, and write anything else under its notes.

### METRICS-01: The Panel Opens and Closes

**Preconditions:** **People** page open from the left-hand menu.

- [x] **Step 1.** Select **Metrics** above the table.
  - **Expected:** The Metrics panel opens on the right, and the table narrows beside it. The panel has **Break down by** set to **Choose a column**, and says **Choose a column to count people by its values.**
  - **Notes:**

- [FAIL] **Step 2.** Press Esc.
  - **Expected:** The panel closes, and the **Metrics** button has the keyboard focus.
  - **Notes:** Not relaible. Might close with esc, migh tnot.

- [x] **Step 3.** Open the **Position** column menu, and select **Break down by**.
  - **Expected:** The panel opens with **Break down by** set to **Position**, showing a row for each position.
  - **Notes:**

- [x] **Step 4.** Select the **×** button at the top right of the panel.
  - **Expected:** The panel closes.
  - **Notes:**

- [x] **Step 5.** Open the **Name** column menu.
  - **Expected:** The menu has no **Break down by**.
  - **Notes:**

### METRICS-02: One Column Is Counted With Shares

**Preconditions:** **People** page open. Live only shown (P3).

- [x] **Step 1.** Select **Metrics**, then set **Break down by** to **Position**.
  - **Expected:** The count line says **150 people**. The rows are Software Engineer 69 (46%), Test Engineer 35 (23.3%), SDET 30 (20%), Manager 16 (10.7%) and Architect 0 (0%). No row shows **Live**.
  - **Notes:**

- [x] **Step 2.** Set **Break down by** to **Role on team**.
  - **Expected:** Team Lead shows 23 and Design Authority 6, followed by an **Empty** row for everyone else. A note under the table says **A person may hold several choices of Role on team, so shares can add up to more than 100%.**
  - **Notes:**

- [x] **Step 3.** Set **Break down by** to **End**.
  - **Expected:** **Populated** shows 11 and **Empty** 139.
  - **Notes:**[Comment: we should be able to add a date to compare how many on and before and how many on or after]

### METRICS-03: Two Columns Are Crossed

**Preconditions:** As METRICS-02, with the panel open.

- [x] **Step 1.** Set **Break down by** to **Position**, then **and by** to **Site**.
  - **Expected:** A table headed **Position by Site** has a column for each site and an **All** column, and a row for each position and an **All** row. The **All** row shows Kestrel Bay 31, Northmere 33, Ashgrove 47, Corran Quay 39 and All 150. **Count** is selected above the table.
  - **Notes:**

- [x] **Step 2.** Select **Share** above the table.
  - **Expected:** Each figure becomes a percentage of the 150 people. The **All** row's **All** figure is 100%.
  - **Notes:**

- [x] **Step 3.** Set **and by** to **Nothing more**.
  - **Expected:** The panel shows Position alone again, as in METRICS-02 step 1.
  - **Notes:**

### METRICS-04: Metrics Follow the Search and Filters

**Preconditions:** As METRICS-02, with **Break down by** set to **Position**.

- [ ] **Step 1.** Open the **Site** column menu, select **Filter…**, and pick only **Ashgrove**. Press Esc.
  - **Expected:** The bar above the table says **47 of 150**. The count line says **47 people**. The rows are Software Engineer 20 (42.6%), Test Engineer 12 (25.5%), SDET 6 (12.8%), Manager 9 (19.1%) and Architect 0 (0%).
  - **Notes:**

- [ ] **Step 2.** Type `Corran` in the search box.
  - **Expected:** The table shows no one, and the count line says **0 people**.
  - **Notes:**

- [ ] **Step 3.** Select **Clear all** in the bar above the table.
  - **Expected:** The search and the filter are cleared. The panel stays open, and the count line says **150 people** again.
  - **Notes:**

### METRICS-05: Metrics Follow the Draft Menu

**Preconditions:** **People** page open, with the Draft menu's **Drafts beside live** chosen, as it is by default. Metrics panel open.

- [ ] **Step 1.** Look at the count line.
  - **Expected:** It says **151 people with drafts, 150 live**.
  - **Notes:**

- [ ] **Step 2.** Set **Break down by** to **Grade**.
  - **Expected:** The **P1** row shows a count with a dimmed **Live 17** under it. Rows whose count drafts do not change show no **Live** figure.
  - **Notes:**

- [ ] **Step 3.** Open the Draft menu and select **Drafts applied**. Press Esc.
  - **Expected:** The count line says **150 people**, without **with drafts**. No figure has a **Live** figure under it.
  - **Notes:**

- [ ] **Step 4.** Open the Draft menu and select **Live only**. Press Esc.
  - **Expected:** The column is called **Level** again, and **Break down by** still shows it. **P1** shows 17, and no figure has a **Live** figure under it.
  - **Notes:**

### METRICS-06: The Panel Is Resized

**Preconditions:** **People** page open, with the Metrics panel open.

- [ ] **Step 1.** Drag the panel edge to the left.
  - **Expected:** The panel widens and the table narrows as you drag.
  - **Notes:**

- [ ] **Step 2.** Keep dragging to the left, as far as the window allows.
  - **Expected:** The panel stops widening while the table still shows its first columns.
  - **Notes:**

- [ ] **Step 3.** Select the **Metrics** title at the top of the panel, press Shift+Tab once, then press the Right arrow key three times.
  - **Expected:** A blue line shows on the panel edge, and the panel narrows a little with each press.
  - **Notes:**

- [ ] **Step 4.** Reload the page.
  - **Expected:** The panel opens again at the width it was left.
  - **Notes:**

### METRICS-07: Metrics Are Kept in Saved Views

**Preconditions:** **People** page open. Live only shown (P3). Metrics panel open, with **Break down by** set to **Position** and **and by** to **Site**.

- [ ] **Step 1.** Open the Views menu, select **Save view…**, type `Fictional positions by site`, and select **Save**.
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

**Preconditions:** **People** page open, with the Metrics panel open.

- [ ] **Step 1.** Make the browser window narrower than 768 pixels.
  - **Expected:** The panel covers the page below the top bar, and the panel edge is gone.
  - **Notes:**

- [ ] **Step 2.** Press Tab repeatedly.
  - **Expected:** The focus moves only among the panel's controls, never to the table behind it.
  - **Notes:**

- [ ] **Step 3.** Press Esc, then make the window wide again.
  - **Expected:** The panel closes, and the table fills the page.
  - **Notes:**
