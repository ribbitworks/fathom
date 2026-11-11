---
title: "Manual Test: Number Columns"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/db/migrations/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Number Columns

## Scope

Verifies what only a person can judge of Number columns on the People table: how the column dialog offers the type, how numbers read and line up in cells and in the details panel, and how sorting and filtering by number look.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Appearance menu and the column menu. This test adds:

- **Score cell:** a cell in the **Score** column, which NUM-01 adds at the right end of the People table; scroll right to reach it.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### NUM-01: The Dialog Offers a Number Column

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Select **New column**.
  - **Expected:** The **New column** dialog opens.
  - **Notes:**

- [ ] **Step 2.** Open **Type**.
  - **Expected:** **Number** is listed.
  - **Notes:**

- [ ] **Step 3.** Choose **Number**.
  - **Expected:**
    - **List** and **Several choices** are gone.
    - **Visible to** is shown.
  - **Notes:**

- [ ] **Step 4.** Type `Score` in **Name**, then select **Add column**.
  - **Expected:**
    - The dialog closes, and a **Score** column with empty cells is at the right end of the table.
    - The whole of **Draft: added** shows under its name.
  - **Notes:**

### NUM-02: Numbers Read Well in Cells

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NUM-01.

**Preconditions:** As NUM-01, with the **Score** column added.

- [ ] **Step 1.** In the first three rows' Score cells, type `1234.5`, `-7` and `0`, pressing Enter after each.
  - **Expected:**
    - The cells read **1,234.5**, **-7** and **0**, or as the browser's language writes them.
    - Each is marked as a draft.
  - **Notes:**

- [ ] **Step 2.** In the fourth row's Score cell, type `abc` and press Enter.
  - **Expected:**
    - The cell stays open, outlined in red.
    - **Score: use a number such as 1234.5** shows in red under the row, in its first cell.
  - **Notes:**

- [ ] **Step 3.** Press Esc.
  - **Expected:** The cell is empty again.
  - **Notes:**

- [ ] **Step 4.** Select the small button with an arrow out of a box at the right of the first row's **Name** cell.
  - **Expected:** The panel lists **Score** with **1,234.5**, or as the browser's language writes it.
  - **Notes:**

- [ ] **Step 5.** Close the panel, then switch between **Light** and **Dark** in the Appearance menu.
  - **Expected:** The numbers are easy to read in both.
  - **Notes:**

### NUM-03: Sorting and Filtering by Number

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NUM-02.

**Preconditions:** As NUM-02, with the three numbers typed.

- [ ] **Step 1.** Select the **Score** header.
  - **Expected:** The menu offers **Lowest first** and **Highest first**.
  - **Notes:**

- [ ] **Step 2.** Select **Highest first**.
  - **Expected:**
    - Among the rows marked as drafts, **Score** reads **1,234.5**, then **0**, then **-7** from the top.
    - Rows with no number come after them.
  - **Notes:**

- [ ] **Step 3.** Select the **Score** header, then **Filter…**.
  - **Expected:**
    - The filter shows **At least** and **At most** fields, with **At least** ready to type in.
    - A **No number** checkbox is under them.
    - A field holding text shows an × at its right end.
  - **Notes:**

- [ ] **Step 4.** Type `0` in **At least**.
  - **Expected:**
    - Rows reading **1,234.5** and **0** are shown.
    - No row reading **-7** is shown.
  - **Notes:**

- [ ] **Step 5.** Type `abc` in **At most**.
  - **Expected:**
    - **Use a number such as 1234.5** shows in red under **At most**.
    - The rows shown do not change.
  - **Notes:**

**Afterwards:** Run Reset the Database.
