---
title: "Manual Test: Number Columns"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/db/migrations/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-13"
---

# Manual Test: Number Columns

## Scope

Verifies what only a person can judge of Number columns on the People table: how the column dialog offers the type, how numbers read and line up in cells and in the details panel, and how sorting and filtering by number look.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the column menu. This test adds:

- **Score cell:** a cell in the **Score** column, which NUM-01 adds at the right end of the People table; scroll right to reach it.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### NUM-01: The Dialog Offers a Number Column

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `DBEB` Select **New column**.
  - **Expected:** The **New column** dialog opens.
  - **Notes:**

- [ ] `EA9A` Open **Type**.
  - **Expected:** **Number** is listed.
  - **Notes:**

- [ ] `BD21` Choose **Number**.
  - **Expected:**
    - **List** and **Several choices** are gone.
    - **Class** is shown.
    - **General** is chosen.
  - **Notes:**

- [ ] `74C1` Type `Score` in **Name**.
  - **Expected:** **Name** holds `Score`.
  - **Notes:**

- [ ] `0FBA` Select **Add column**.
  - **Expected:**
    - The dialog closes.
    - A **Score** column is at the right end of the table.
    - Its cells are empty.
    - A hollow yellow dot is before **Score** in the header.
  - **Notes:**

### NUM-02: Numbers Read Well in Cells

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NUM-01.

**Preconditions:** As NUM-01, with the **Score** column added.

- [ ] `6A37` In the first row's Score cell, type `1234.5` and press Enter.
  - **Expected:**
    - The cell reads "1,234.5", or as the browser's language writes it.
    - It has a hollow yellow dot before it.
  - **Notes:**

- [ ] `1E4A` In the second row's Score cell, type `-7` and press Enter.
  - **Expected:**
    - The cell reads "-7", or as the browser's language writes it.
    - It has a hollow yellow dot before it.
  - **Notes:**

- [ ] `B00C` In the third row's Score cell, type `0` and press Enter.
  - **Expected:**
    - The cell reads "0", or as the browser's language writes it.
    - It has a hollow yellow dot before it.
  - **Notes:**

- [ ] `F1A2` In the fourth row's Score cell, type `abc` and press Enter.
  - **Expected:**
    - The cell stays open.
    - It is outlined in red.
    - "Score: use a number such as 1234.5" shows in red under the row, in its first cell.
  - **Notes:**

- [ ] `4BE1` Press Esc.
  - **Expected:** The cell is empty again.
  - **Notes:**

- [ ] `FCE6` Select the small button with an arrow out of a box at the right of the first row's **Name** cell.
  - **Expected:** The panel lists **Score** with "1,234.5", or as the browser's language writes it.
  - **Notes:**

- [ ] `B718` Close the panel.
  - **Expected:** The panel closes.
  - **Notes:**

### NUM-03: Sorting and Filtering by Number

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NUM-02.

**Preconditions:** As NUM-02, with the three numbers typed.

- [ ] `AD21` Select the **Score** header.
  - **Expected:** The menu offers **Lowest first** and **Highest first**.
  - **Notes:**

- [ ] `F0E6` Select **Highest first**.
  - **Expected:**
    - Among the rows marked as drafts, **Score** reads "1,234.5", then "0", then "-7" from the top.
    - Rows with no number come after them.
  - **Notes:**

- [ ] `9A02` Select the **Score** header, then **Filter…**.
  - **Expected:**
    - The filter shows **At least** and **At most** fields.
    - **At least** is ready to type in.
    - A **No number** checkbox is under them.
    - A field holding text shows an × at its right end.
  - **Notes:**

- [ ] `20EF` Type `0` in **At least**.
  - **Expected:**
    - Rows reading "1,234.5" and "0" are shown.
    - No row reading "-7" is shown.
  - **Notes:**

- [ ] `AE38` Type `abc` in **At most**.
  - **Expected:**
    - "Use a number such as 1234.5" shows in red under **At most**.
    - Rows reading "1,234.5" and "0" are shown.
    - No row reading "-7" is shown.
  - **Notes:**

**Afterwards:** Run Reset the Database.
