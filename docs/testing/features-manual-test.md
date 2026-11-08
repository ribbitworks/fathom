---
title: "Manual Test: Features"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-08"
---

# Manual Test: Features

## Scope

Verifies the Features page: how the table of features looks and reads, its groups by cycle with Later, editing features as drafts, who may change them, and how feature drafts show on the Drafts page and when a cycle changes length.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account. They share one password, which R1 prints when it finishes.

- **Product Manager account:** `product.manager@fathom.test`, shown in Fathom as **Product Manager**. It holds the Product Manager role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Project Manager account:** `project.manager@fathom.test`, shown in Fathom as **Project Manager**. It holds the Project Manager role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Team Member account:** `team.member@fathom.test`, shown in Fathom as **Team Member**. It holds the Team Member role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use after R0, before the first test case, and wherever a test case says so. Fathom keeps running. This removes the seed data and every draft of it, including drafts made during the test, then adds the seed data again; it keeps accounts and anything else added by hand.

1. In the second terminal, run:

   ```sh
   pnpm db:reseed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

## Terms

- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown in a row's first cell.
- **⋯ menu:** the menu that opens from the **⋯** button at the end of a row.
- **Group heading:** the full-width row above each group of features, naming its cycle or **Later**.

## Test Cases

Run the test cases in order. Start with R0, then R1. Check each step whose expected result you see, and write anything else under its notes.

### FEAT-01: The Table Reads Well in Light and Dark

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select **Features** in the left-hand menu.
  - **Expected:** The page is titled **Features**. The table's columns are, in order, **Name**, **Status**, **Target cycle**, **Feature team** and **Description**. Beside the search box, the count reads **11 features**.
  - **Notes:**

- [ ] **Step 2.** Look down the **Status** column.
  - **Expected:** Each row reads one of **Possible**, **Planned**, **In progress**, **Done** or **Cancelled**.
  - **Notes:**

- [ ] **Step 3.** Switch Fathom between light and dark mode, and look at the group headings, the rows and the column headers.
  - **Expected:** In both modes every word is easy to read, and the group headings are clearly set apart from the rows.
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

- [ ] **Step 5.** Select **Group by cycle** above the table.
  - **Expected:** The headings are gone and the 11 rows show as one list.
  - **Notes:**

- [ ] **Step 6.** Reload the page.
  - **Expected:** The rows still show as one list.
  - **Notes:**

- [ ] **Step 7.** Select **Group by cycle** again.
  - **Expected:** The headings are back, as in Step 1.
  - **Notes:**

### FEAT-03: A Planned Feature With No Feature Team Is Marked

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-02 ended with.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** Look at the **Feature team** cell of the row **Scheduler API**.
  - **Expected:** The cell has a red dot and **No team**.
  - **Notes:**

- [ ] **Step 2.** Look at the **Feature team** cell of the row **Voice Notes**.
  - **Expected:** The cell is empty, with no mark.
  - **Notes:**

### FEAT-04: Adding and Changing Features Makes Drafts

**Account:** Product Manager, `product.manager@fathom.test`, the account FEAT-03 ended with.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** In the empty row at the end of the table, type `Fictional Reports` in **Name**, then press Enter.
  - **Expected:** The row is tinted as a draft, with a hollow yellow dot and **Draft: added**, and its **Status** reads **Possible**. It stays where it is until the view next changes.
  - **Notes:**

- [ ] **Step 2.** Reload the page.
  - **Expected:** **Fictional Reports** is under the heading **Later**, with the same mark.
  - **Notes:**

- [ ] **Step 3.** In the row **Report Builder**, select the **Target cycle** cell and choose another cycle from the list.
  - **Expected:** Each choice names its stream and cycle. The cell turns yellow, with a light green row under it, marked **Live**, showing the old cycle. The row keeps its place until the view next changes.
  - **Notes:**

- [ ] **Step 4.** Select **Publish** in the top bar.
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

- [ ] **Step 1.** Select **Drafts** in the left-hand menu.
  - **Expected:** The list has an entry that names **the feature Fictional Reports**, with a filled yellow dot and **Draft: added**.
  - **Notes:**

### FEAT-07: Those Who Only See the Plan Cannot Change Features

**Account:** Team Member, `team.member@fathom.test`, changed from FEAT-06.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select **Features** in the left-hand menu.
  - **Expected:** The table shows, with no **New feature** button and no empty row at its end.
  - **Notes:**

- [ ] **Step 2.** Double-click the **Status** cell of any row.
  - **Expected:** The cell does not open for editing.
  - **Notes:**

### FEAT-08: Features Follow a Cycle That Changes Length

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FEAT-07.

**Preconditions:** Run R1 first. Signed in with this account. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** In the side panel's **Cycles** table, select the **⋯** button at the end of next quarter's cycle, then **Change length…**.
  - **Expected:** A dialog titled **Change the length of** that cycle opens.
  - **Notes:**

- [ ] **Step 2.** Replace **3** in **Length** with `2`.
  - **Expected:** Below **New dates**, the dialog says that **Harbor 3**, **Data Retention Controls** and **Report Builder** move with their cycles.
  - **Notes:**

- [ ] **Step 3.** Select **Change length**.
  - **Expected:** A notification says **Drafted the new length.**
  - **Notes:**

- [ ] **Step 4.** Select **Publish** in the top bar.
  - **Expected:** The **Publish** button is gone from the top bar.
  - **Notes:**

- [ ] **Step 5.** Sign out, sign in as the Project Manager, `project.manager@fathom.test`, and select **Drafts** in the left-hand menu.
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

**Preconditions:** Run R1 first. Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select the **Name** cell of the last row under a group heading, then press the Down arrow.
  - **Expected:** The selection moves to the **Name** cell of the first row under the next heading, without stopping on the heading.
  - **Notes:**
