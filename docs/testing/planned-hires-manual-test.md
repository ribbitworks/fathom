---
title: "Manual Test: Planned Hires on People"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-08"
---

# Manual Test: Planned Hires on People

## Scope

Verifies planned hires shown as rows of the People table: how their rows look beside people's in light and dark mode, their names, the **State** column, their values in added columns, a column switched off for them, people who have left, saving a view of planned hires alone, a planned manager whom other planned hires report to, adding one with the keyboard and by pasting, approving a hire's draft on the Drafts page, what a Resource Planner sees, and filling a hire from its details panel with a new or an existing person. The seeded hires are listed in [Development Setup](../design/development-setup.md#fictional-seed-data).

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser.
- A plain text editor, for copying rows to paste.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Engineering Director account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. It holds the Engineering Director role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Resource Planner account:** `resource.planner@fathom.test`, shown in Fathom as **Resource Planner**. It holds the Resource Planner role, as [Roles](../product/roles.md#starting-roles) sets out.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use after R0, before the first test case, and wherever a test case says so. Fathom keeps running. This removes the seed data and every draft of it, including drafts made during the test and anyone added by filling a seeded hire, then adds the seed data again; it keeps accounts and anything else added by hand.

1. In the second terminal, run:

   ```sh
   pnpm db:unseed && pnpm db:seed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

## Terms

- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance**, in the menu that opens from your name and initials at the top right of every page.
- **Search for:** type the text in the search box above the People table, so only the matching rows are shown.
- **Hire rows:** the rows at the bottom of the People table whose **ID** is a requisition, such as **REQ-2042**, or starts with **TBD-**.
- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown beside a row's name.
- **Publish button:** the button in the top bar, beside your name, that reads **Publish** followed by a number of changes.
- **⋯ menu:** the menu that opens from the **⋯** button at the end of a row.

## Test Cases

Run the test cases in order. Start with R0, then R1. Check each step whose expected result you see, and write anything else under its notes.

### HIRE-01: Hire Rows Sit Under the People and Read Well in Light and Dark Mode

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** **Light** chosen in the Appearance menu. Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Read the column headers from left to right.
  - **Expected:** **Name**, **ID**, **Position** and **State** come first, in that order, and **Expected** comes after **Start**. There is no **Kind** column.
  - **Notes:**

- [ ] **Step 2.** Scroll to the bottom of the table.
  - **Expected:** The hire rows come after every person, followed by one empty row. The empty row's cells are all blank.
  - **Notes:**

- [ ] **Step 3.** Read the **Name** cells of the hire rows **REQ-2042** and **REQ-2047**.
  - **Expected:** **SDET, REQ-2042** and **Software Engineer, REQ-2047**, in grey italics. The hire rows **Backend engineer 1**, **Backend engineer 2** and **Payments tester** show their names in the usual colour.
  - **Notes:**

- [ ] **Step 4.** Read a hire row's **End**, **Manager?**, **Manager since** and **Team name** cells, and the **Expected** cell of a person.
  - **Expected:** All are blank. The hire row's **Expected** cell holds a month and year, such as **Jan 2027**.
  - **Notes:**

- [ ] **Step 5.** Choose **Dark** in the Appearance menu, and look over the same rows.
  - **Expected:** The grey names, the yellow draft cells, the red rejected cells and the light green **Live** rows under the drafted hires are all easy to read and tell apart.
  - **Notes:**

- [ ] **Step 6.** Choose **Light** in the Appearance menu.
  - **Expected:** The rows return to their light colours.
  - **Notes:**

### HIRE-02: A Hire's Name Can Be Typed and Cleared

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-01.

**Preconditions:** As HIRE-01, with **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Search for **SDET, REQ-2042**. Select the row's **Name** cell, type **Fictional test lead**, and press Enter.
  - **Expected:** The cell reads **Fictional test lead** in the usual colour and turns yellow. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Clear the search, and search for **Fictional test lead**. Select the row's **Name** cell, press Backspace, and press Enter if an editor opened.
  - **Expected:** The cell reads **SDET, REQ-2042** in grey italics again.
  - **Notes:**

**Afterwards:** R1.

### HIRE-03: Hired Is Not Offered for a Hire, and States Are Filtered Together

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-02.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Search for **REQ-2047**. Select the row's **State** cell and press Enter.
  - **Expected:** A picker opens offering **Request to hire** and **Approved to hire** only. **Hired** and **Left** are not offered.
  - **Notes:**

- [ ] **Step 2.** Select the **State** header, then **Filter…**, and look at the choices.
  - **Expected:** **Request to hire**, **Approved to hire**, **Hired**, **Left** and **Empty** are listed together, with no **Retired** heading.
  - **Notes:**

- [ ] **Step 3.** Tick **Hired** only.
  - **Expected:** Only people are shown, with no hire rows, and every **State** cell reads **Hired**.
  - **Notes:**

**Afterwards:** R1.

### HIRE-04: A Planned Hire Is Added With the Keyboard Alone

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-03.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Select the **Name** cell of the empty row at the bottom of the table. Using only the keyboard, move to its **State** cell, press Enter, choose **Request to hire**, and press Enter.
  - **Expected:** The row's **State** cell reads **Request to hire**, and its other cells are blank.
  - **Notes:**

- [ ] **Step 2.** Using only the keyboard, move to the row's **Position** cell, press Enter, choose **SDET**, and press Enter.
  - **Expected:** The row is added with an ID starting with **TBD-**, and a **Name** of **SDET, TBD-** followed by the same number, in grey italics. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

**Afterwards:** R1.

### HIRE-05: Planned Hires Are Pasted From a Text Editor

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-04.

**Preconditions:** Signed in with this account. **People** page open. In the text editor, two lines, typed with the Tab key where shown:

- First line: **Fictional pasted hire**, Tab, **REQ-3001**, Tab, **SDET**, Tab, **Request to hire**.
- Second line: Tab, **REQ-3002**, Tab, **Software Engineer**, Tab, **Request to hire**.

- [ ] **Step 1.** Copy both lines. Select the **Name** cell of the empty row at the bottom of the table, and paste.
  - **Expected:** Two hire rows are added: **Fictional pasted hire** with ID **REQ-3001**, and **Software Engineer, REQ-3002** in grey italics. Each reads **Request to hire** in **State** and has a hollow yellow dot and **Draft**.
  - **Notes:**

**Afterwards:** R1.

### HIRE-06: A Planned Hire Is Added, Approved, and Seen by a Resource Planner

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-05. Steps 3 and 5 sign in as other accounts.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Select **New** at the top right. In the panel, choose **Request to hire** in **State**, type **Fictional platform hire** in **Name** and **REQ-3100** in **ID**, choose **Software Engineer** in **Position**, and select **Add**.
  - **Expected:** The panel shows **Fictional platform hire**. Its row in the table has a hollow yellow dot and **Draft**, and **Request to hire** in **State**.
  - **Notes:**

- [ ] **Step 2.** Select the Publish button.
  - **Expected:** A notice reads **Published 1 change.**
  - **Notes:**

- [ ] **Step 3.** Sign in as the Engineering Director, `engineering.director@fathom.test`, changing account. Open **Drafts** and type **REQ-3100** in the search box.
  - **Expected:** One entry is shown, adding the planned hire **Fictional platform hire**.
  - **Notes:**

- [ ] **Step 4.** Select the entry's checkbox, then **Approve**. In the dialog, select **Approve**.
  - **Expected:** The dialog closes, and a notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 5.** Sign in as the Resource Planner, `resource.planner@fathom.test`, changing account. Open **People** and search for **Fictional platform hire**.
  - **Expected:** One hire row, with no **Draft** mark, reading **REQ-3100** in **ID**, **Software Engineer** in **Position**, and **Request to hire** in **State**.
  - **Notes:**

**Afterwards:** R1.

### HIRE-07: A Resource Planner Sees Placeholders Only

**Account:** Resource Planner, `resource.planner@fathom.test`, the same as the account HIRE-06 ended with.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Select the **State** header, then **Filter…**. Tick **Request to hire** and **Approved to hire**, and press Esc.
  - **Expected:** Only hire rows are shown. None has a **Draft** mark, and there is no **Start** column. **REQ-2036** is among them, and **REQ-2050** is not.
  - **Notes:**

- [ ] **Step 2.** Read the **Name** cells of **Backend engineer 1** and **REQ-2042**, and the **Site** cell of **Backend engineer 1**.
  - **Expected:** **Backend engineer 1** in the usual colour, and **SDET, REQ-2042** in grey italics. The **Site** cell reads **Kestrel Bay**.
  - **Notes:**

- [ ] **Step 3.** Select a hire row's **Name** cell and type a letter.
  - **Expected:** No editor opens.
  - **Notes:**

- [ ] **Step 4.** Select **Clear all** above the table, so every row is shown again. Then select **Metrics** above the table, and choose **Expected** in **Break down by**.
  - **Expected:** A row for each month a hire is expected, such as **Jan 2027**, in month order, and an **Empty** row counting the people.
  - **Notes:**

### HIRE-08: A Hire's Values in Added Columns Are Shown and Changed

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from HIRE-07.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Search for **Payments tester**, and read the row's **Site** and **Level** cells.
  - **Expected:** **Northmere** and **P2**.
  - **Notes:**

- [ ] **Step 2.** Select the row's **Site** cell, press Enter, choose **Ashgrove**, and press Enter.
  - **Expected:** The cell reads **Ashgrove** and turns yellow, and the row has a hollow yellow dot and **Draft**.
  - **Notes:**

**Afterwards:** R1.

### HIRE-09: A Column Switched Off for Planned Hires Leaves Their Cells Blank

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-08.

**Preconditions:** Signed in with this account. **Light** chosen in the Appearance menu. **People** page open.

- [ ] **Step 1.** Select the **Skills** header, then **Edit column**.
  - **Expected:** A dialog titled **Edit column** shows **Offered on planned hires** ticked, and **Planned hires can leave it empty** under **Must be filled in**.
  - **Notes:**

- [ ] **Step 2.** Untick **Offered on planned hires**.
  - **Expected:** **Planned hires can leave it empty** is no longer shown.
  - **Notes:**

- [ ] **Step 3.** Select **Save**. Search for **Payments tester**, select the row's **Skills** cell, and type a letter.
  - **Expected:** The dialog has closed. The cell is blank, and no editor opens.
  - **Notes:**

- [ ] **Step 4.** Clear the search. Select the **Site** header, then **Edit column**. Untick **Offered on planned hires**, and select **Save**.
  - **Expected:** The dialog stays open, with this message in red under the checkboxes: **3 planned hires have values in Site, so it cannot be switched off for planned hires yet. Clear them first.**
  - **Notes:**

- [ ] **Step 5.** Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] **Step 6.** Choose **Dark** in the Appearance menu.
  - **Expected:** The page turns dark.
  - **Notes:**

- [ ] **Step 7.** Open **Edit column** from the **Site** header again.
  - **Expected:** The checkboxes, their labels and **Planned hires can leave it empty** are easy to read.
  - **Notes:**

- [ ] **Step 8.** Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] **Step 9.** Choose **Light** in the Appearance menu.
  - **Expected:** The page returns to its light colours.
  - **Notes:**

**Afterwards:** R1.

### HIRE-10: A Person Who Has Left Shows Left, to Everyone Who Sees People

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-09. Step 3 signs in as another account.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Select the **State** header, then **Filter…**. Tick **Left** only, and press Esc.
  - **Expected:** Only people are shown, **Viktoria Holmberg** among them. Every **State** cell reads **Left**, and every **End** cell holds a date that has passed.
  - **Notes:**

- [ ] **Step 2.** Select the **State** cell of the first row with no **Draft** mark beside its name, and press Enter.
  - **Expected:** A picker opens offering **Left** only. Press Esc to close it.
  - **Notes:**

- [ ] **Step 3.** Sign in as the Resource Planner, `resource.planner@fathom.test`, changing account. Open **People**, and filter **State** to **Left** only, as in Step 1.
  - **Expected:** The same people are shown, **Viktoria Holmberg** among them, each with **Left** in **State**. There are no **Start** or **End** columns.
  - **Notes:**

**Afterwards:** R1.

### HIRE-11: A View of Planned Hires Alone Is Saved and Applied

**Account:** Resource Planner, `resource.planner@fathom.test`, the same as the account HIRE-10 ended with.

**Preconditions:** R1 run after HIRE-10. Signed in with this account. **People** page open, with no filters.

- [ ] **Step 1.** Select the **State** header, then **Filter…**. Tick **Request to hire** and **Approved to hire** only, and press Esc.
  - **Expected:** Only hire rows are shown.
  - **Notes:**

- [ ] **Step 2.** Select the **Expected** header, then **List order**.
  - **Expected:** The same hire rows are shown, earliest **Expected** month first.
  - **Notes:**

- [ ] **Step 3.** Select the **Views** button after the search box, then **Save view…**. Type **Hiring plan** in **Name**, and select **Save view**.
  - **Expected:** The dialog closes with no error, and the button now reads **Hiring plan**.
  - **Notes:**

- [ ] **Step 4.** Select **Hiring plan**, then **Clear view**.
  - **Expected:** Every row is shown again, people and planned hires.
  - **Notes:**

- [ ] **Step 5.** Select **Views**, then **Hiring plan**.
  - **Expected:** The same hire rows as in Step 2 are shown, in the same order.
  - **Notes:**

- [ ] **Step 6.** Select **Hiring plan**, then **Delete view**.
  - **Expected:** A notice reads **Deleted the Hiring plan view.**, with **Undo**. The hire rows stay as they are, and the button now reads **Views**, marked with a dot.
  - **Notes:**

### HIRE-12: Planned Hires Report to a Planned Manager

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from HIRE-11.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] **Step 1.** Type **Engineering Manager TBD** in the search box.
  - **Expected:** One row is shown, its **Name** **Engineering Manager, TBD-** and a number, in grey italics. Its **Manager?** cell shows a checked box.
  - **Notes:**

- [ ] **Step 2.** Clear the search box, and type **Platform engineer TBD**.
  - **Expected:** One row is shown, its **Name** **Platform engineer**. Its **Manager** and **Team** both read **Engineering Manager, TBD-** and the same number.
  - **Notes:**

- [ ] **Step 3.** Select the row's **Manager** cell, and press Enter.
  - **Expected:** The cell opens for typing, with a list of managers under it.
  - **Notes:**

- [ ] **Step 4.** Type **TBD**.
  - **Expected:** The list offers **Engineering Manager, TBD-** and the same number.
  - **Notes:**

- [ ] **Step 5.** Press Esc, clear the search box, and type **Engineering Manager TBD**.
  - **Expected:** One row is shown, **Engineering Manager, TBD-** and the same number.
  - **Notes:**

- [ ] **Step 6.** Click once in the row's **Manager?** cell.
  - **Expected:** A message reads **Reassign direct reports first**. The box stays checked, and the row has no **Draft** mark.
  - **Notes:**

**Afterwards:** R1.

### HIRE-13: A Planned Hire Is Filled With a New Person

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-12. Step 7 signs in as another account.

**Preconditions:** Signed in with this account. **Light** chosen in the Appearance menu. **People** page open, with no filters.

- [ ] **Step 1.** Type **Backend engineer 2** in the search box, and look at the row's **Name** cell.
  - **Expected:** A **Fill** button sits at the right of the cell, and **Backend engineer 2** is still readable beside it.
  - **Notes:**

- [ ] **Step 2.** Select **Fill**.
  - **Expected:** The panel beside the table is headed **Backend engineer 2**. Under **Fill this planned hire**, **New person** is selected next to **Existing person**, with fields **Name**, **ID**, **Position**, **Start** and **Manager**. **Position** reads **Software Engineer**, with no pencil. **Start** holds the same date as the row's **Start** cell in the table, and **Manager** the same name as its **Manager** cell.
  - **Notes:**

- [ ] **Step 3.** Type **Fictional new starter** in **Name** and **EMP-9001** in **ID**, and select **Fill** at the foot of the panel.
  - **Expected:** The form closes and the panel is headed **Fictional new starter**, with a hollow yellow dot and **Draft**. The **Backend engineer 2** row no longer has a **Fill** button, and has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 4.** Select the button with an arrow out of a box at the right of the **Backend engineer 2** row's **Name** cell.
  - **Expected:** The panel is headed **Backend engineer 2**, with a **Filled by** section under its heading reading **Fictional new starter** in **Name** and **EMP-9001** in **ID**, each a link that shows that person in the panel.
  - **Notes:**

- [ ] **Step 5.** Clear the search box, and type **Fictional new starter**.
  - **Expected:** One row, with a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 6.** Select the Publish button.
  - **Expected:** A notice reads **Published 2 changes.**
  - **Notes:**

- [ ] **Step 7.** Sign in as the Engineering Director, `engineering.director@fathom.test`, changing account. Open **Drafts**, type **Backend engineer 2** in the search box, select the entry's checkbox, then **Approve**.
  - **Expected:** The dialog reads **Also approves the drafts these depend on:** and names **Fictional new starter**.
  - **Notes:**

- [ ] **Step 8.** In the dialog, select **Approve**.
  - **Expected:** The dialog closes, and a notice says the drafts were approved.
  - **Notes:**

- [ ] **Step 9.** Open **People** and type **Fictional new starter** in the search box.
  - **Expected:** One row, with no **Draft** mark, reading **Software Engineer** in **Position**, a name in **Manager**, and **Ashgrove** in **Site**. Searching for **Backend engineer 2** shows no row named **Backend engineer 2**.
  - **Notes:**

**Afterwards:** R1.

### HIRE-14: A Planned Hire Is Filled With Someone Already in Fathom

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from HIRE-13.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] **Step 1.** Search for **REQ-2042**, select the row's **Fill** button, and in the panel select **Existing person**.
  - **Expected:** The **Person** row is empty, with a pencil button at its right. **Position** reads the planned hire's position, with no pencil.
  - **Notes:**

- [ ] **Step 2.** Select the pencil, and scroll through the list.
  - **Expected:** Each entry shows a name, an ID in brackets, and a position, in name order. No planned hires are listed. The list scrolls within itself, and the panel stays the same width as the list opens and closes.
  - **Notes:**

- [ ] **Step 3.** Without typing, select the first person in the list. If no **Manager since** row then shows, select the pencil and choose the next person in the list.
  - **Expected:** The **Person** row shows who you chose. **Position** still reads the planned hire's position, and **Manager** the name in the row's **Manager** cell in the table. **Manager since** holds today's date.
  - **Notes:**

- [ ] **Step 4.** Select the pencil beside **Manager**, and choose a different name from the one shown.
  - **Expected:** The **Manager** row shows the name you chose, and **Manager since** still holds today's date.
  - **Notes:**

- [ ] **Step 5.** Select **Fill** at the foot of the panel.
  - **Expected:** The form closes and the panel is headed with the person you chose. Its **Manager** row reads the name you chose in Step 4, and its **Position** row the planned hire's position, each with a yellow dot and **Draft** beside it.
  - **Notes:**

**Afterwards:** R1.

### HIRE-15: Filling a Planned Manager Moves Its Planned Hires

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-14.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] **Step 1.** Type **Engineering Manager TBD** in the search box, and look at the row's **Name** cell.
  - **Expected:** There is no **Fill** button, since its **State** is **Request to hire**.
  - **Notes:**

- [ ] **Step 2.** Select the row's **State** cell, press Enter, choose **Approved to hire**, and press Enter.
  - **Expected:** A **Fill** button shows in the row's **Name** cell.
  - **Notes:**

- [ ] **Step 3.** Select **Fill**.
  - **Expected:** A **Direct reports** row names the planned hires that report to this one, **Platform engineer** among them.
  - **Notes:**

- [ ] **Step 4.** Type **Fictional new lead** in **Name** and **EMP-9002** in **ID**, select the pencil beside **Grade**, and choose **P1**.
  - **Expected:** The fields hold what you entered, and **Grade** reads **P1**.
  - **Notes:**

- [ ] **Step 5.** Select **Fill** at the foot of the panel.
  - **Expected:** The form closes and the panel is headed **Fictional new lead**.
  - **Notes:**

- [ ] **Step 6.** Clear the search box, and type **Platform engineer TBD**.
  - **Expected:** The **Manager** cell of **Platform engineer** reads **Fictional new lead**, and the row has a hollow yellow dot and **Draft**.
  - **Notes:**

**Afterwards:** R1.

### HIRE-16: The Fill Form Reads Well in Dark Mode, and Leaving It Asks First

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-15.

**Preconditions:** Signed in with this account. **Dark** chosen in the Appearance menu. **People** page open, with no filters.

- [ ] **Step 1.** Search for **REQ-2047**, and look at the row. Select **Fill**.
  - **Expected:** The row's **Fill** button, the panel's **New person** and **Existing person** choice, and its fields are all easy to read.
  - **Notes:**

- [ ] **Step 2.** Type **Fictional name** in **Name**, and select **Cancel**.
  - **Expected:** A dialog titled **Stop filling this planned hire?** offers **Keep filling** and **Discard**.
  - **Notes:**

- [ ] **Step 3.** Select **Keep filling**.
  - **Expected:** The dialog closes, and **Name** still reads **Fictional name**.
  - **Notes:**

- [ ] **Step 4.** Select **Cancel**, then **Discard**.
  - **Expected:** The panel shows the hire's details, and a **Fill** button under its heading, with focus on it.
  - **Notes:**

### HIRE-17: A Hire Under a Planned Manager Needs a Manager Chosen

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-16.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] **Step 1.** Search for **Platform engineer TBD**. Select the row's **State** cell, press Enter, choose **Approved to hire**, and press Enter. Select the row's **Fill** button.
  - **Expected:** The form's **Manager** row reads **No manager**.
  - **Notes:**

- [ ] **Step 2.** Type **Fictional platform starter** in **Name** and **EMP-9003** in **ID**, and select **Fill** at the foot of the panel.
  - **Expected:** **Manager needed** shows in red under **Manager**, and **Grade needed** under **Grade**.
  - **Notes:**

- [ ] **Step 3.** Select the pencil beside **Manager** and choose the first name in the list. Select the pencil beside **Grade** and choose **P1**. Select **Fill** at the foot of the panel.
  - **Expected:** The form closes and the panel is headed **Fictional platform starter**. Its **Manager** row reads the name you chose.
  - **Notes:**

**Afterwards:** R1.
