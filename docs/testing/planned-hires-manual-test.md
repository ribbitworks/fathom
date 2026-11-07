---
title: "Manual Test: Planned Hires on People"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-06"
---

# Manual Test: Planned Hires on People

## Scope

Verifies planned hires shown as rows of the People table: how their rows look beside people's in light and dark mode, their names, the **State** column, adding one with the keyboard and by pasting, approving a hire's draft on the Drafts page, and what a Resource Planner sees. The seeded hires are listed in [Development Setup](../design/development-setup.md#fictional-seed-data).

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser whose operating system can switch between light and dark appearance.
- A plain text editor, for copying rows to paste.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It can change people and planned hires, and its changes are drafts; it cannot approve them.
- **Approver account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. It can approve and reject drafts.
- **Resource Planner account:** `resource.planner@fathom.test`, shown in Fathom as **Resource Planner**. It sees people and the planned hires' placeholders, and cannot change them.

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

## Terms

- **Search for:** type the text in the search box above the People table, so only the matching rows are shown.
- **Hire rows:** the rows at the bottom of the People table whose **ID** is a requisition, such as **REQ-2042**, or starts with **TBD-**.
- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown beside a row's name.
- **Publish button:** the button in the top bar, beside your name, that reads **Publish** followed by a number of changes.
- **⋯ menu:** the menu that opens from the **⋯** button at the end of a row.

## Test Cases

Run the test cases in order. Start with R0, then R1. Check each step whose expected result you see, and write anything else under its notes.

### HIRE-01: Hire Rows Sit Under the People and Read Well in Light and Dark Mode

**Preconditions:** Operating system in light appearance. Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open from the left-hand menu.

- [ ] **Step 1.** Read the column headers from left to right.
  - **Expected:** **Name**, **ID**, **Position** and **State** come first, in that order, and **Expected** comes after **Start**. There is no **Kind** column.
  - **Notes:**

- [ ] **Step 2.** Scroll to the bottom of the table.
  - **Expected:** The hire rows come after every person, followed by one empty row. The empty row's cells are all blank.
  - **Notes:**

- [ ] **Step 3.** Read the **Name** cells of the hire rows **REQ-2042** and **REQ-2047**.
  - **Expected:** **SDET, REQ-2042** and **Software Engineer, REQ-2047**, in grey italics. The hire rows **Backend engineer 1**, **Backend engineer 2** and **Payments tester** show their names in the usual colour.
  - **Notes:**

- [ ] **Step 4.** Read the **State** cells down the table.
  - **Expected:** Every person's reads **Hired**. Each hire row's reads **Request to hire** or **Approved to hire**.
  - **Notes:**

- [ ] **Step 5.** Read a hire row's **End**, **Manager?**, **Manager since** and **Team name** cells, and the **Expected** cell of a person.
  - **Expected:** All are blank. The hire row's **Expected** cell holds a month and year, such as **Jan 2027**.
  - **Notes:**

- [ ] **Step 6.** Switch the operating system to dark appearance, and look over the same rows.
  - **Expected:** The grey names, the yellow draft cells, the red rejected cells and the light green **Live** rows under the drafted hires are all easy to read and tell apart. Switch back to light appearance afterwards.
  - **Notes:**

### HIRE-02: A Hire's Name Can Be Typed and Cleared

**Preconditions:** As HIRE-01, in light appearance.

- [ ] **Step 1.** Search for **SDET, REQ-2042**. Select the row's **Name** cell, type **Fictional test lead**, and press Enter.
  - **Expected:** The cell reads **Fictional test lead** in the usual colour and turns yellow. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Clear the search. Search for **Fictional test lead**.
  - **Expected:** Only that row is shown.
  - **Notes:**

- [ ] **Step 3.** Select the row's **Name** cell, press Backspace, and press Enter if an editor opened.
  - **Expected:** The cell reads **SDET, REQ-2042** in grey italics again.
  - **Notes:**

**Afterwards:** R1.

### HIRE-03: State Is Read Only for People, and Hired Is Not Offered for a Hire

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open.

- [ ] **Step 1.** Search for **Max Munk**. Select the row's **State** cell and press Enter, then type a letter.
  - **Expected:** No editor opens, and the cell still reads **Hired**.
  - **Notes:**

- [ ] **Step 2.** Clear the search, and search for **REQ-2047**. Select the row's **State** cell and press Enter.
  - **Expected:** A picker opens offering **Request to hire** and **Approved to hire** only. **Hired** is not offered.
  - **Notes:**

- [ ] **Step 3.** Choose **Request to hire** and press Enter.
  - **Expected:** The cell reads **Request to hire** and turns yellow. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 4.** Select the funnel beside the **State** header, and look at the choices.
  - **Expected:** **Request to hire**, **Approved to hire**, **Hired** and **Empty** are listed together, with no **Retired** heading.
  - **Notes:**

- [ ] **Step 5.** Tick **Hired** only.
  - **Expected:** Only people are shown, with no hire rows.
  - **Notes:**

**Afterwards:** R1.

### HIRE-04: A Planned Hire Is Added With the Keyboard Alone

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open.

- [ ] **Step 1.** Select **New planned hire** above the table.
  - **Expected:** Focus moves to the empty row at the bottom. Its **State** cell reads **Request to hire**, and its other cells are blank.
  - **Notes:**

- [ ] **Step 2.** Using only the keyboard, move to the row's **ID** cell, type **TBD-99**, and press Tab.
  - **Expected:** A message reads **An ID cannot start with TBD-, which temporary IDs use**.
  - **Notes:**

- [ ] **Step 3.** Clear the **ID** cell. Move to **Position**, press Enter, choose **SDET**, and press Enter.
  - **Expected:** The row is added with an ID starting with **TBD-**, and a **Name** of **SDET, TBD-** followed by the same number, in grey italics. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 4.** Open the new row's ⋯ menu.
  - **Expected:** It offers **Remove planned hire**.
  - **Notes:**

- [ ] **Step 5.** Select **Remove planned hire**.
  - **Expected:** The row is gone, and a notice reads **Discarded the draft adding the planned hire SDET, TBD-** followed by its number.
  - **Notes:**

**Afterwards:** R1.

### HIRE-05: Planned Hires Are Pasted From a Text Editor

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open. In the text editor, two lines, typed with the Tab key where shown:

- First line: **Fictional pasted hire**, Tab, **REQ-3001**, Tab, **SDET**.
- Second line: Tab, **REQ-3002**, Tab, **Software Engineer**.

- [ ] **Step 1.** Copy both lines. Select **New planned hire**, select the new row's **Name** cell, and paste.
  - **Expected:** Two hire rows are added: **Fictional pasted hire** with ID **REQ-3001**, and **Software Engineer, REQ-3002** in grey italics. Each reads **Request to hire** in **State** and has a hollow yellow dot and **Draft**.
  - **Notes:**

**Afterwards:** R1.

### HIRE-06: A Planned Hire Is Added, Approved, and Seen by a Resource Planner

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open.

- [ ] **Step 1.** Select **New planned hire**. In the new row, type **Fictional platform hire** in **Name**, press Tab, type **REQ-3100** in **ID**, press Tab, choose **Software Engineer** in **Position**, and press Enter.
  - **Expected:** The row is added with a hollow yellow dot and **Draft**, and **Request to hire** in **State**.
  - **Notes:**

- [ ] **Step 2.** Select the Publish button.
  - **Expected:** A notice reads **Published 1 change.**
  - **Notes:**

- [ ] **Step 3.** Sign in (P1) as `engineering.director@fathom.test`. Open **Drafts** and type **REQ-3100** in the search box.
  - **Expected:** One entry is shown, adding the planned hire **Fictional platform hire**.
  - **Notes:**

- [ ] **Step 4.** Select the entry's checkbox, then **Approve**. In the dialog, select **Approve**.
  - **Expected:** The dialog closes, and a notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 5.** Sign in (P1) as `resource.planner@fathom.test`. Open **People** and search for **Fictional platform hire**.
  - **Expected:** One hire row, with no **Draft** mark, reading **REQ-3100** in **ID**, **Software Engineer** in **Position**, and **Request to hire** in **State**.
  - **Notes:**

**Afterwards:** R1.

### HIRE-07: A Resource Planner Sees Placeholders Only

**Preconditions:** Signed in (P1) as `resource.planner@fathom.test`. **People** page open.

- [ ] **Step 1.** Scroll to the hire rows.
  - **Expected:** They have no **Draft** marks and no **Start** column. **REQ-2036** is among them, and **REQ-2050** is not.
  - **Notes:**

- [ ] **Step 2.** Read the **Name** cells of **Backend engineer 1** and **REQ-2042**.
  - **Expected:** **Backend engineer 1** in the usual colour, and **SDET, REQ-2042** in grey italics.
  - **Notes:**

- [ ] **Step 3.** Select a hire row's **Name** cell and type a letter.
  - **Expected:** No editor opens.
  - **Notes:**

- [ ] **Step 4.** Select **Metrics** above the table, and choose **Expected** in **Break down by**.
  - **Expected:** A row for each month a hire is expected, such as **Jan 2027**, in month order, and an **Empty** row counting the people.
  - **Notes:**
