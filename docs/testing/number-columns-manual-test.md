---
title: "Manual Test: Number Columns"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/db/migrations/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-08"
---

# Manual Test: Number Columns

## Scope

Verifies what only a person can judge of Number columns on the People table: how the column dialog offers the type, how numbers read and line up in cells and in the details panel, and how sorting and filtering by number look.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates this account, with every other development account. The accounts share one password, which R1 prints when it finishes.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at the address the terminal prints, such as `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Reset the Database

Use before the first test case and after the last. This deletes every account and record in the development database, including anything added by hand.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Start Fathom again (R0).

## Terms

- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance**, in the menu that opens from your name and initials at the top right of every page.
- **Score cell:** a cell in the **Score** column, which NUM-01 adds at the right end of the People table; scroll right to reach it.

## Test Cases

Run R1 first.

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
  - **Expected:** **List** and **Several choices** are gone, and **Visible to** is shown.
  - **Notes:**

- [ ] **Step 4.** Type `Score` in **Name**, then select **Add column**.
  - **Expected:** The dialog closes and a **Score** column with empty cells is at the right end of the table. The whole of **Draft: added** shows under its name.
  - **Notes:**

### NUM-02: Numbers Read Well in Cells

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NUM-01.

**Preconditions:** As NUM-01, with the **Score** column added.

- [ ] **Step 1.** In the first three rows' Score cells, type `1234.5`, `-7` and `0`, pressing Enter after each.
  - **Expected:** The cells read **1,234.5**, **-7** and **0**, or as the browser's language writes them, and each is marked as a draft.
  - **Notes:**

- [ ] **Step 2.** In the fourth row's Score cell, type `abc` and press Enter.
  - **Expected:** The cell is marked as wrong and the message reads **Score: use a number such as 1234.5**. The words read naturally.
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
  - **Expected:** Among the rows marked as drafts, **Score** reads **1,234.5**, then **0**, then **-7** from the top, and rows with no number come after them.
  - **Notes:**

- [ ] **Step 3.** Select the **Score** header, then **Filter…**.
  - **Expected:** The filter shows **At least** and **At most** fields, with **At least** ready to type in, and a **No number** checkbox. A field holding text shows an × at its right end.
  - **Notes:**

- [ ] **Step 4.** Type `0` in **At least**.
  - **Expected:** Rows reading **1,234.5** and **0** are shown, and no row reading **-7**.
  - **Notes:**

- [ ] **Step 5.** Type `abc` in **At most**.
  - **Expected:** **At most** reads **Use a number such as 1234.5** under it, in red, and the rows shown do not change.
  - **Notes:**

Run R1 after the last test case.
