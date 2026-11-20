---
title: "Manual Test: Planned Hires on People"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/people.md"]
last_updated: "2026-11-20"
---

# Manual Test: Planned Hires on People

## Scope

Verifies planned hires shown as rows of the People table: how their rows look beside people's, their names, the **State** column, a column planned hires have values in, people who have left, a planned manager whom other planned hires report to, adding one with the keyboard and by pasting, what a Feature Lead sees, and filling a hire from its details panel with a new or an existing person, approved on the Drafts page. The seeded hires are listed in [Development Setup](../design/development-setup.md#fictional-data).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A plain text editor, for copying rows to paste.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Engineering Director:** `engineering.director@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes). Restore the Seed Data also removes anyone added by filling a seeded hire.

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Publish button, searching for text and the ⋯ menu. This test adds:

- **Hire rows:** the rows at the bottom of the People table whose **ID** is a requisition, such as 'REQ-2042', or starts with "TBD-".

## Test Cases

Run the test cases in the order they are listed. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### HIRE-01: Hire Rows Sit Under the People and Read Well

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `0DE2` Read the column headers from left to right.
  - **Expected:**
    - **Name**, **ID** and **Position** come first, in that order.
    - **State** comes after the added columns, just before **Start**.
    - **Expected** comes after **Start**.
    - There is no **Kind** column.
  - **Notes:**

- [ ] `FF79` Scroll to the bottom of the table.
  - **Expected:**
    - The hire rows come after every person.
    - One empty row follows them.
    - The empty row's cells are all blank.
  - **Notes:**

- [ ] `383C` Read the **Name** cells of the hire rows 'REQ-2042' and 'REQ-2047', then of 'Backend engineer 1', 'Backend engineer 2' and 'Payments tester'.
  - **Expected:**
    - "SDET, REQ-2042" and "Software Engineer, REQ-2047", in grey italics.
    - 'Backend engineer 1', 'Backend engineer 2' and 'Payments tester' in the usual colour.
  - **Notes:**

- [ ] `D2C9` Read the **End**, **Manager?**, **Manager assigned** and **Team name** cells of the row for 'Payments tester', and the **Expected** cell of a person.
  - **Expected:**
    - All are blank.
    - The **Expected** cell of 'Payments tester' holds a month and year, such as "Feb 2027".
  - **Notes:**

### HIRE-03: Hiring States and People's States Are Filtered Together

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-01.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `407B` Select the **State** header, then **Filter…**, and look at the choices.
  - **Expected:**
    - **Request to hire**, **Approved to hire**, **Hired**, **Left**, **Empty** and **Not empty** are listed together.
    - There is no **Retired** heading.
  - **Notes:**

- [ ] `4DD3` Tick **Hired** only.
  - **Expected:**
    - Only people are shown, with no hire rows.
    - Every **State** cell reads "Hired".
  - **Notes:**

### HIRE-04: A Planned Hire Is Added With the Keyboard Alone

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-03.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `A03C` Select the **Name** cell of the empty row at the bottom of the table.
  - **Expected:** The empty row's **Name** cell is selected.
  - **Notes:**

- [ ] `F913` Using only the keyboard, move to the row's **State** cell.
  - **Expected:** The row's **State** cell is selected.
  - **Notes:**

- [ ] `E8B6` Press Enter, choose **Request to hire**, and press Enter.
  - **Expected:**
    - The row's **State** cell reads "Request to hire".
    - Its other cells are blank.
  - **Notes:**

- [ ] `7CDA` Using only the keyboard, move to the row's **Position** cell.
  - **Expected:** The row's **Position** cell is selected.
  - **Notes:**

- [ ] `857C` Press Enter, choose 'SDET', and press Enter.
  - **Expected:**
    - The row is added with an ID starting with "TBD-".
    - Its **Name** reads "SDET, TBD-" followed by the number in its ID, in grey italics.
    - The row has a hollow yellow dot in its slot.
  - **Notes:**

### HIRE-05: Planned Hires Are Pasted From a Text Editor

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-04.

**Preconditions:** Signed in with this account. **People** page open. In the text editor, two lines, typed with the Tab key where shown:

- First line: `Fictional pasted hire`, Tab, `REQ-3001`, Tab, `SDET`, Tab, `Request to hire`.
- Second line: Tab, `REQ-3002`, Tab, `Software Engineer`, Tab, `Request to hire`.

- [ ] `470C` In the text editor, select both lines and copy them.
  - **Expected:** Both lines are highlighted in the text editor.
  - **Notes:**

- [ ] `19B3` Select the **Name** cell of the empty row at the bottom of the table.
  - **Expected:** The empty row's **Name** cell is selected.
  - **Notes:**

- [ ] `4EA4` Paste.
  - **Expected:** Two hire rows are added:
    - `Fictional pasted hire`, with ID `REQ-3001`
    - "Software Engineer, REQ-3002", in grey italics
    - Each reads "Request to hire" in **State**
    - Each has a hollow yellow dot in its slot
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

### HIRE-06: A Planned Hire Is Added, Approved, and Seen by a Feature Lead

Covered by [HIRE-13](#hire-13-a-planned-hire-is-filled-with-a-new-person) and [HIRE-07](#hire-07-a-feature-lead-sees-placeholders-only).

### HIRE-09: A Column Planned Hires Have Values In Is Not Switched Off for Them

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-05.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] `B950` Select the **Site** header, then **Edit column…**.
  - **Expected:**
    - A dialog titled "Edit column" opens.
    - **Offered on planned hires** is ticked.
  - **Notes:**

- [ ] `A000` Untick **Offered on planned hires**.
  - **Expected:** **Offered on planned hires** is unticked.
  - **Notes:**

- [ ] `C35E` Select **Save**.
  - **Expected:**
    - The dialog stays open.
    - This message shows in red under the checkboxes: "3 planned hires have values in Site, so it cannot be switched off for planned hires yet. Clear them first."
  - **Notes:**

- [ ] `D4B5` Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

### HIRE-10: A Person Who Has Left Shows Left, Only to Those Who See Personal Details

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-09. Step `A4B7` signs in as another account.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] `AAC4` Select the **State** header, then **Filter…**.
  - **Expected:** **Left** is among the choices.
  - **Notes:**

- [ ] `2EAE` Tick **Left** only.
  - **Expected:** **Left** is the only choice ticked.
  - **Notes:**

- [ ] `F1B2` Press Esc.
  - **Expected:**
    - Only people are shown.
    - 'Viktoria Holmberg' is among them.
    - Every **State** cell reads "Left".
    - Every **End** cell holds a date that has passed.
  - **Notes:**

- [ ] `A4B7` Sign in as the Feature Lead, `feature.lead@fathom.test`, changing account.
  - **Expected:** The top bar's right end reads "Feature Lead".
  - **Notes:**

- [ ] `320C` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `502E` Select the **State** header, then **Filter…**.
  - **Expected:** **Left** is among the choices.
  - **Notes:**

- [ ] `5C46` Tick **Left** only.
  - **Expected:** **Left** is the only choice ticked.
  - **Notes:**

- [ ] `E076` Press Esc.
  - **Expected:**
    - No one is shown.
    - 'Viktoria Holmberg' is not listed.
    - There are no **Start** or **End** columns.
  - **Notes:**

### HIRE-07: A Feature Lead Sees Placeholders Only

**Account:** Feature Lead, `feature.lead@fathom.test`, the same as the account HIRE-10 ended with.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `CC22` Select the **State** header, then **Filter…**.
  - **Expected:** The choices include **Request to hire** and **Approved to hire**.
  - **Notes:**

- [ ] `4D21` Tick **Request to hire**.
  - **Expected:** **Request to hire** is ticked.
  - **Notes:**

- [ ] `A3AF` Tick **Approved to hire**.
  - **Expected:** **Approved to hire** is ticked.
  - **Notes:**

- [ ] `32FF` Press Esc.
  - **Expected:**
    - Only hire rows are shown.
    - None has a dot.
    - There is no **Start** column.
    - 'REQ-2036' is among them.
    - 'REQ-2050' is not among them.
  - **Notes:**

- [ ] `F5F4` Select the **Expected** header, then **List order**.
  - **Expected:**
    - Only hire rows are shown.
    - They are in order of **Expected**, earliest month first.
    - The first row is 'Data engineer', whose **Expected** is last month.
  - **Notes:**

- [ ] `A133` Read the **Name** cells of 'Backend engineer 1' and 'REQ-2042', and the **Site** cell of 'Backend engineer 1'.
  - **Expected:**
    - 'Backend engineer 1' in the usual colour.
    - "SDET, REQ-2042" in grey italics.
    - The **Site** cell reads 'Kestrel Bay'.
  - **Notes:**

- [ ] `ECD5` Select a hire row's **Name** cell and type a letter.
  - **Expected:** No editor opens.
  - **Notes:**

- [ ] `56BE` Select **Clear all** above the table.
  - **Expected:** Every row is shown again.
  - **Notes:**

- [ ] `EF24` Select **Metrics** above the table.
  - **Expected:** **Break down by** is shown.
  - **Notes:**

- [ ] `11F9` Choose **Expected** in **Break down by**.
  - **Expected:**
    - A row for each month a hire is expected, such as "Jan 2027", in month order.
    - An **Empty** row counting the people.
  - **Notes:**

### HIRE-11: A View of Planned Hires Alone Is Saved and Applied

Covered by [HIRE-07](#hire-07-a-feature-lead-sees-placeholders-only).

### HIRE-12: Planned Hires Report to a Planned Manager

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from HIRE-07.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `312D` Type `Engineering Manager TBD` in the search box.
  - **Expected:**
    - Three rows are shown:
      - the planned Engineering Manager, whose **Name** reads "Engineering Manager, TBD-" and a number, in grey italics
      - 'Platform engineer'
      - "SDET, TBD-" and another number
    - The planned Engineering Manager's **Manager?** cell shows a checked box.
  - **Notes:**

- [ ] `71B8` Clear the search box, and type `Platform engineer TBD`.
  - **Expected:**
    - One row is shown.
    - Its **Name** reads 'Platform engineer'.
    - Its **Manager** and **Team** both read "Engineering Manager, TBD-" and the same number.
  - **Notes:**

### HIRE-13: A Planned Hire Is Filled With a New Person

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-12. Step `6F7D` signs in as another account.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `8EC5` Type `Backend engineer 2` in the search box, and look at the **Name** cell of the row for 'Backend engineer 2'.
  - **Expected:**
    - A **Fill** button sits at the right of the cell.
    - 'Backend engineer 2' is still readable beside it.
  - **Notes:**

- [ ] `0DD1` Select **Fill**.
  - **Expected:**
    - The panel beside the table is headed 'Backend engineer 2'.
    - Under **Fill this planned hire**, **New person** is selected next to **Existing person**.
    - The fields are **Name**, **ID**, **Position**, **Start** and **Manager**.
    - **Position** reads 'Software Engineer'.
    - **Position** has no change button.
    - **Start** holds the date in the row's **Start** cell, visible beside the panel.
    - **Manager** holds the name in the row's **Manager** cell.
  - **Notes:**

- [ ] `B707` Type `Fictional new starter` in **Name**.
  - **Expected:** **Name** holds `Fictional new starter`.
  - **Notes:**

- [ ] `ECCC` Type `EMP-9001` in **ID**.
  - **Expected:** **ID** holds `EMP-9001`.
  - **Notes:**

- [ ] `0EC8` Select **Fill** at the foot of the panel.
  - **Expected:**
    - The form closes.
    - The panel is headed `Fictional new starter`.
    - A hollow yellow dot is before the heading.
    - The 'Backend engineer 2' row no longer has a **Fill** button.
    - The 'Backend engineer 2' row has a hollow yellow dot in its slot.
  - **Notes:**

- [ ] `B81E` Select the Publish button.
  - **Expected:** A notice reads "Published 2 changes."
  - **Notes:**

- [ ] `6F7D` Sign in as the Engineering Director, `engineering.director@fathom.test`, changing account.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `1F65` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `83A3` Type `Backend engineer 2` in the search box.
  - **Expected:** A row's **Record** reads 'Backend engineer 2'.
  - **Notes:**

- [ ] `D979` Tick the tick box of the row of 'Backend engineer 2'.
  - **Expected:**
    - The row's tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `1BCB` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:**
    - The dialog reads "Also approves the drafts these depend on:".
    - It names `Fictional new starter`.
  - **Notes:**

- [ ] `36EF` In the dialog, select **Approve**.
  - **Expected:**
    - The dialog closes.
    - A notice says the drafts were approved.
  - **Notes:**

- [ ] `639B` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `298C` Type `Fictional new starter` in the search box.
  - **Expected:** One row:
    - No dot.
    - 'Software Engineer' in **Position**
    - A name in **Manager**.
    - 'Ashgrove' in **Site**.
  - **Notes:**

### HIRE-14: A Planned Hire Is Filled With Someone Already in Fathom

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from HIRE-13.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `13FE` Search for `REQ-2042`.
  - **Expected:**
    - The "SDET, REQ-2042" row is shown.
    - It has a **Fill** button.
  - **Notes:**

- [ ] `53D7` Select the row's **Fill** button.
  - **Expected:** Under **Fill this planned hire**, **New person** is selected next to **Existing person**.
  - **Notes:**

- [ ] `111D` In the panel, select **Existing person**.
  - **Expected:**
    - The **Person** row is empty.
    - A change button is at its right.
    - **Position** reads the planned hire's position.
    - **Position** has no change button.
  - **Notes:**

- [ ] `5EC6` Select the change button.
  - **Expected:**
    - A list opens.
    - Each entry shows a name, an ID in brackets, and a position.
    - The entries are in name order.
    - No planned hires are listed.
    - The panel stays the same width as the list opens.
  - **Notes:**

- [ ] `E508` Scroll through the list.
  - **Expected:** The list scrolls within itself.
  - **Notes:**

- [ ] `70EB` Without typing, select the first person in the list. If no **Manager assigned** row then shows, select the change button and choose the next person in the list.
  - **Expected:**
    - The panel stays the same width as the list closes.
    - The **Person** row shows the person chosen.
    - **Position** still reads the planned hire's position.
    - **Manager** reads the name in the row's **Manager** cell in the table.
    - **Manager assigned** holds today's date.
  - **Notes:**

- [ ] `2C76` Select the change button beside **Manager**, and choose a different name from the one shown.
  - **Expected:**
    - The **Manager** row shows the name chosen.
    - **Manager assigned** still holds today's date.
  - **Notes:**

- [ ] `FC42` Select **Fill** at the foot of the panel.
  - **Expected:**
    - The form closes.
    - The panel is headed with the person chosen in Step `70EB`.
    - Its **Manager** row reads the name chosen in Step `2C76`.
    - A hollow yellow dot is before the **Manager** row.
    - Its **Position** row reads the planned hire's position.
    - A hollow yellow dot is before the **Position** row.
  - **Notes:**

### HIRE-15: Filling a Planned Manager Moves Its Planned Hires

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-14.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `2ED2` Type `Engineering Manager TBD` in the search box, and look at the **State** and **Name** cells of the row whose **Name** reads "Engineering Manager, TBD-" and a number.
  - **Expected:**
    - **State** reads "Request to hire".
    - There is no **Fill** button in the **Name** cell.
  - **Notes:**

- [ ] `07FA` Select that row's **State** cell, press Enter, choose **Approved to hire**, and press Enter.
  - **Expected:** A **Fill** button shows in that row's **Name** cell.
  - **Notes:**

- [ ] `8DB0` Select **Fill**.
  - **Expected:**
    - A **Direct reports** row names the planned hires that report to this one.
    - 'Platform engineer' is among them.
  - **Notes:**

- [ ] `68B0` Type `Fictional new lead` in **Name**.
  - **Expected:** **Name** holds `Fictional new lead`.
  - **Notes:**

- [ ] `02D2` Type `EMP-9002` in **ID**.
  - **Expected:** **ID** holds `EMP-9002`.
  - **Notes:**

- [ ] `F905` Select the change button beside **Grade**, and choose 'P1'.
  - **Expected:** The form reads:
    - `Fictional new lead` in **Name**
    - `EMP-9002` in **ID**
    - 'P1' in **Grade**
  - **Notes:**

- [ ] `4A12` Select **Fill** at the foot of the panel.
  - **Expected:**
    - The form closes.
    - The panel is headed `Fictional new lead`.
  - **Notes:**

### HIRE-16: The Fill Form Reads Well, and Leaving It Asks First

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as HIRE-15.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `DB8B` Search for `REQ-2047`, and look at the row.
  - **Expected:** The row's **Fill** button is easy to read.
  - **Notes:**

- [ ] `145E` Select **Fill**.
  - **Expected:** These are all easy to read:
    - the panel's **New person** and **Existing person** choice
    - the panel's fields
  - **Notes:**

- [ ] `746A` Type `Fictional name` in **Name**.
  - **Expected:** **Name** holds `Fictional name`.
  - **Notes:**

- [ ] `60D4` Select **Cancel**.
  - **Expected:**
    - A dialog titled "Stop filling this planned hire?" opens.
    - It offers **Keep filling** and **Discard**.
  - **Notes:**

- [ ] `3C3D` Select **Keep filling**.
  - **Expected:**
    - The dialog closes.
    - **Name** still reads `Fictional name`.
  - **Notes:**

- [ ] `8FF5` Select **Cancel**.
  - **Expected:** The dialog titled "Stop filling this planned hire?" opens.
  - **Notes:**

- [ ] `5A61` Select **Discard**.
  - **Expected:**
    - The panel shows the hire's details.
    - A **Fill** button is under its heading.
    - Focus is on the **Fill** button.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.
