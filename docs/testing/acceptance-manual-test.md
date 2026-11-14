---
title: "Manual Test: End-to-End Acceptance"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/product/roles.md"]
last_updated: "2026-11-13"
---

# Manual Test: End-to-End Acceptance

## Scope

Verifies Fathom's common use by every persona in [Roles](../product/roles.md#roles-by-persona), in journeys that pass work from one account to the next: hiring and People, saved views, the org chart, feature teams and feature assignments, the plan from projects to releases, administration, and an organization setting Fathom up from an empty database, with feature teams recorded from months ago and planned months ahead. Each feature is run once as it is usually used and once in a less usual way. The feature manual tests in `docs/testing/` cover each feature in depth.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A browser window at least 1,440 pixels wide.
- A second browser, or a private window, for signing in as a second account while the first stays signed in.
- A plain text editor, for typing lines to copy and paste into a table.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses the account of each persona in [Roles](../product/roles.md#roles-by-persona):

- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`
- **Engineering Manager:** `engineering.manager@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`, holding the Feature Lead role, its default, and the Engineering Manager role
- **Engineering Director:** `engineering.director@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as "Second Engineering Operations Manager"
- **Executive:** `executive@fathom.test`
- **Team Member:** `team.member@fathom.test`
- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as "Fathom Administrator"

This test creates:

- **New account:** `fictional.newcomer@fathom.test`, shown in Fathom as `Fictional Newcomer`. ACC-37 creates it with the Team Member role, and its password is the one ACC-37 shows, until ACC-37 changes it to `fictional password 2`. ACC-38 gives it the `Fictional Reader` role in place of Team Member.
- **Planning lead account:** `fictional.planning.lead@fathom.test`, shown in Fathom as `Fictional Planning Lead`. ACC-46 creates it with the Workforce Administrator role, its default, and the Product Manager role, and its password is the one ACC-46 shows, until ACC-50 changes it to `fictional password 3`.

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Start From an Empty Database](manual-test-basics.md#start-from-an-empty-database), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the account menu, marks, the lock, boxes, a row's slot, Draft rows and Live rows, the Publish button, the finder, the teams switch, the team panel and seeded dates. This test adds:

- **Seeded dates in this test:** **Next quarter's cycle** is the 'Platform' stream's cycle for the quarter after the one today is in. The examples after "such as" are as the seed data is when added in November 2026.
- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20300315`.
- **Months from today:** the steps name months by where they fall from the current month: **last month** is the one before it, **next month** the one after it, a number of **months ago**, such as **six months ago**, that many months before it, and **three months from now** the third month after it. The steps type a month's first day as digits; the examples after "such as" are for a run in November 2026, such as `20260501` for the first day of six months ago.
- **Empty row:** the row at the end of a table, with blank cells, where a new record is typed or pasted.
- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**. Accounts that don't see Personal details have the arrows, timeline and **Today** without it.

## Test Cases

Run the test cases in order, in about three and a half hours: two hours and 50 minutes for Journeys 1 to 5, and 40 minutes for Journey 6. Start with Start Fathom, then Reset the Database; Journey 6 starts again with Start From an Empty Database, and the last test case runs Reset the Database to put everything back. Check each step whose expected result you see, and write anything else under its notes.

### Journey 1: Hiring and People

#### ACC-01: A Planned Hire Is Added and Approved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step `BCEB` signs in as another account.

**Preconditions:** Reset the Database run. Signed in with this account. **People** page open from the left-hand menu.

- [ ] `72EE` Select **New** at the top right of the page.
  - **Expected:** The details panel opens, headed **New person**.
  - **Notes:**

- [ ] `F311` Select the change button beside **State**, and choose **Request to hire**.
  - **Expected:** The details panel is headed **New planned hire**.
  - **Notes:**

- [ ] `56DD` Type `Fictional mobile tester` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `4E64` Type `REQ-5001` in **ID**.
  - **Expected:** **ID** shows what was typed.
  - **Notes:**

- [ ] `02F0` Choose 'SDET' in **Position** from its change button.
  - **Expected:** **Position** reads 'SDET'.
  - **Notes:**

- [ ] `3FC5` Select **Add**.
  - **Expected:**
    - The panel shows `Fictional mobile tester`.
    - Its row in the table has a hollow yellow dot in its slot.
    - The row reads "Request to hire" in **State**.
  - **Notes:**

- [ ] `A6B1` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `BCEB` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `EA10` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `0AF7` Type `REQ-5001` in the search box.
  - **Expected:**
    - One entry is shown, adding the planned hire `Fictional mobile tester`.
    - The entry has a checkbox.
  - **Notes:**

- [ ] `FC26` Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `222E` Select **Approve 1 draft**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `7C9C` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice reads "Approved 1 draft."
  - **Notes:**

- [ ] `E9E5` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `2D61` Search for `Fictional mobile tester`.
  - **Expected:**
    - One hire row is shown, with no dot.
    - It reads `REQ-5001` in **ID**.
    - It reads 'SDET' in **Position**.
    - It reads "Request to hire" in **State**.
  - **Notes:**

#### ACC-02: Someone Who Has Not Started Is Listed Only for Those Who See Personal Details

**Account:** Product Manager, `product.manager@fathom.test`, changed from the account ACC-01 ended with. Step `D7B6` signs in as another account.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `4D1A` Search for `Chatura Abbott`.
  - **Expected:**
    - No row is shown.
    - The table has no **Start** or **End** column.
  - **Notes:**

- [ ] `D7B6` Sign out, and sign in as the Engineering Manager, `engineering.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Manager".
  - **Notes:**

- [ ] `544F` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `CC9C` Search for `Chatura Abbott`.
  - **Expected:** One row, for 'Chatura Abbott', whose **Start** cell holds a date after today.
  - **Notes:**

- [ ] `CD51` Select the row's details button.
  - **Expected:**
    - The details panel is headed 'Chatura Abbott'.
    - **Start** under **Details** shows a date after today.
  - **Notes:**

#### ACC-03: A Planned Hire Is Filled With a New Person

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-02. Step `E2C8` signs in as another account.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] `DCF3` Search for `Backend engineer 2`.
  - **Expected:** A row for 'Backend engineer 2' is listed.
  - **Notes:**

- [ ] `7B6C` Select the **Fill** button at the right of the row's **Name** cell.
  - **Expected:**
    - The details panel is headed 'Backend engineer 2'.
    - Under **Fill this planned hire**, **New person** is selected.
    - The fields are **Name**, **ID**, **Position**, **Start** and **Manager**.
    - **Position** reads 'Software Engineer'.
  - **Notes:**

- [ ] `11DB` Type `Fictional new starter` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `435C` Type `EMP-9001` in **ID**.
  - **Expected:** **ID** shows what was typed.
  - **Notes:**

- [ ] `E41B` Select **Fill** at the foot of the panel.
  - **Expected:**
    - The panel is headed with a hollow yellow dot before `Fictional new starter`.
    - The 'Backend engineer 2' row has no **Fill** button.
    - The 'Backend engineer 2' row has a hollow yellow dot in its slot.
  - **Notes:**

- [ ] `9E62` Select the details button of the 'Backend engineer 2' row.
  - **Expected:**
    - The panel is headed 'Backend engineer 2'.
    - A **Filled by** section reads `Fictional new starter` in **Name**.
    - The **Filled by** section reads `EMP-9001` in **ID**.
  - **Notes:**

- [ ] `28AB` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `E2C8` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `BAC3` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `02A5` Type `Backend engineer 2` in the search box.
  - **Expected:** An entry naming 'Backend engineer 2' is listed, with a checkbox.
  - **Notes:**

- [ ] `BCDC` Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `36FF` Select **Approve 1 draft**.
  - **Expected:** The dialog reads "Also approves the drafts these depend on:" and names `Fictional new starter`.
  - **Notes:**

- [ ] `696E` Select **Approve** in the dialog.
  - **Expected:** A notice says the drafts were approved.
  - **Notes:**

- [ ] `E6C5` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `94F2` Search for `Fictional new starter`.
  - **Expected:**
    - One row is shown, with no dot.
    - It reads 'Software Engineer' in **Position**.
    - Its **Manager** holds a name.
  - **Notes:**

- [ ] `6FB2` Search for `Backend engineer 2`.
  - **Expected:** No row named 'Backend engineer 2' is shown.
  - **Notes:**

#### ACC-04: Filling a Planned Manager Moves the Planned Hires Under It

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-03.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] `77C9` Search for `Engineering Manager TBD`.
  - **Expected:** A row for `Engineering Manager TBD` is listed.
  - **Notes:**

- [ ] `28CF` Select the row's **State** cell, press Enter, choose **Approved to hire**, and press Enter.
  - **Expected:** A **Fill** button shows in the row's **Name** cell.
  - **Notes:**

- [ ] `444F` Select **Fill**.
  - **Expected:** A **Direct reports** row names the planned hires that report to this one, 'Platform engineer' among them.
  - **Notes:**

- [ ] `62AF` Type `Fictional new lead` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `8EC5` Type `EMP-9002` in **ID**.
  - **Expected:** **ID** shows what was typed.
  - **Notes:**

- [ ] `6A86` Select the change button beside **Grade**, and choose 'P1'.
  - **Expected:** **Grade** reads 'P1'.
  - **Notes:**

- [ ] `EE35` Select **Fill** at the foot of the panel.
  - **Expected:**
    - The form closes.
    - The panel is headed `Fictional new lead`.
  - **Notes:**

- [ ] `A9B1` Search for `Platform engineer TBD`.
  - **Expected:** The **Manager** cell of 'Platform engineer' reads `Fictional new lead`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `FB18` Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `CF1D` Search for `Platform engineer TBD` again.
  - **Expected:**
    - The **Manager** cell of 'Platform engineer' reads "Engineering Manager, TBD-" and a number.
    - The row has no dot.
  - **Notes:**

#### ACC-05: A New Manager Moves Someone to Their Team

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ACC-04. Step `809A` signs in as another account.

**Preconditions:** **People** page open, with no filters.

- [ ] `8E15` Search for `Samuel Richter`.
  - **Expected:**
    - The **Manager** cell of 'Samuel Richter' reads 'Atmananda Ganaka'.
    - His **Team** cell reads 'Payments team'.
  - **Notes:**

- [ ] `8DC0` Select the row's **Manager** cell, press Enter, type `Max`, and choose 'Max Munk'.
  - **Expected:**
    - The **Manager** cell reads 'Max Munk', with a hollow yellow dot before it.
    - The **Team** cell reads 'Mobile team'.
    - The **Manager assigned** cell holds today's date.
    - The row is faintly yellow.
  - **Notes:**

- [ ] `24E9` Select the row's details button, and read the **Reporting** section.
  - **Expected:**
    - **Manager** reads 'Max Munk', with a hollow yellow dot before it.
    - Under it, 'Atmananda Ganaka' in grey, with a green dot before it.
  - **Notes:**

- [ ] `3D5D` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `809A` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `ED93` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `65D6` Type `Samuel Richter` in the search box.
  - **Expected:** An entry naming 'Samuel Richter' is listed, with a checkbox.
  - **Notes:**

- [ ] `F760` Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `E68F` Select **Approve 1 draft**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `FE6E` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 1 draft."
  - **Notes:**

- [ ] `48DD` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `18A5` Search for `Samuel Richter`.
  - **Expected:**
    - The row has no dot.
    - It reads 'Max Munk' in **Manager**.
    - It reads 'Mobile team' in **Team**.
  - **Notes:**

#### ACC-06: A Number Column Is Added, Approved and Filled In

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-05. Step `8C49` signs in as another account, and step `62B7` signs in with this account again.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] `BF79` Select **New column**.
  - **Expected:** The **New column** dialog opens.
  - **Notes:**

- [ ] `58CE` Choose **Number** in **Type**.
  - **Expected:**
    - **List** and **Several choices** are gone.
    - **Class** is shown, with **General** chosen.
  - **Notes:**

- [ ] `4DA3` Type `On-call weeks` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `B39C` Leave **General** chosen, and select **Add column**.
  - **Expected:**
    - The dialog closes.
    - An **On-call weeks** column with empty cells is at the right end of the table.
    - A hollow yellow dot is before its name.
  - **Notes:**

- [ ] `2C6D` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `8C49` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `874E` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `21C6` Type `On-call` in the search box.
  - **Expected:**
    - One entry is shown, for the column `On-call weeks`.
    - The entry has a checkbox.
  - **Notes:**

- [ ] `A95E` Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `84A9` Select **Approve 1 draft**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `D222` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 1 draft."
  - **Notes:**

- [ ] `62B7` Sign out, and sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Operations Manager".
  - **Notes:**

- [ ] `32A3` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `295B` Search for `Max Munk`.
  - **Expected:** A row for 'Max Munk' is listed.
  - **Notes:**

- [ ] `C82B` Select the **On-call weeks** cell of the 'Max Munk' row, type `4`, and press Enter.
  - **Expected:** The cell reads "4", with a hollow yellow dot before it.
  - **Notes:**

- [ ] `7B26` Search for `Lilian Lang`.
  - **Expected:** A row for 'Lilian Lang' is listed.
  - **Notes:**

- [ ] `B468` Select the **On-call weeks** cell of the 'Lilian Lang' row, type `2.5`, and press Enter.
  - **Expected:**
    - **On-call weeks** has no dot before its name.
    - The cell reads "2.5", with a hollow yellow dot before it.
  - **Notes:**

- [ ] `5DC3` Select the **×** at the right end of the search box.
  - **Expected:** The search box is empty.
  - **Notes:**

- [ ] `2A01` Select the **On-call weeks** header, then **Highest first**.
  - **Expected:**
    - The row of 'Max Munk' comes before that of 'Lilian Lang'.
    - Both come before the rows with no number.
  - **Notes:**

#### ACC-07: Metrics Count People by Two Columns and Follow a Filter

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ACC-06.

**Preconditions:** **People** page open, with no filters and no search.

- [ ] `534E` Select **Metrics** above the table.
  - **Expected:**
    - The Metrics panel opens on the right.
    - The table narrows beside it.
  - **Notes:**

- [ ] `7ECB` Set **Break down by** to **Position**.
  - **Expected:** **Break down by** reads **Position**.
  - **Notes:**

- [ ] `4DDB` Set **and by** to **Site**.
  - **Expected:**
    - A table headed **Position by Site** has a column for each site, an **Empty** column for the planned hires, which have no site, and an **All** column.
    - The **Position by Site** table has a row for each position and an **All** row.
  - **Notes:**

- [ ] `D46A` Open the **Site** column menu, and select **Filter…**.
  - **Expected:**
    - The filter opens.
    - It lists the sites.
  - **Notes:**

- [ ] `40DD` Pick only 'Ashgrove'.
  - **Expected:** 'Ashgrove' is the only site picked.
  - **Notes:**

- [ ] `D6E7` Press Esc.
  - **Expected:**
    - The bar above the table says how many rows are shown of how many, such as "47 of 158".
    - The count line under the panel's title gives the first number in the bar, such as "47 people".
    - The **Position by Site** table has only the 'Ashgrove' column besides **All**.
  - **Notes:**

- [ ] `EBB7` Select **Clear all** in the bar above the table.
  - **Expected:**
    - The filter is cleared.
    - The panel stays open.
  - **Notes:**

#### ACC-08: Metrics Show Live Figures Beside Drafts

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ACC-07.

**Preconditions:** **People** page open, with the Metrics panel open.

- [ ] `F2CD` Open the Draft menu, and select **Drafts beside live**.
  - **Expected:**
    - The Draft menu stays open.
    - A tick is before **Drafts beside live**.
  - **Notes:**

- [ ] `ACCE` Press Esc.
  - **Expected:** The Draft menu closes.
  - **Notes:**

- [ ] `C058` Set **Break down by** to **Grade**.
  - **Expected:** **Break down by** reads **Grade**.
  - **Notes:**

- [ ] `CAEB` Set **and by** to **Nothing more**.
  - **Expected:**
    - At least one row, such as 'P1', shows a count with a dimmed live figure under it, with a green dot before the live figure.
    - Rows whose count the drafts do not change show no live figure.
  - **Notes:**

- [ ] `DDDB` Press Esc.
  - **Expected:**
    - The panel closes.
    - The **Metrics** button has the keyboard focus.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### Journey 2: Saved Views

#### ACC-09: A Personal View Keeps Frozen Columns, Widths and Column Order

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ACC-08.

**Preconditions:** Restore the Seed Data run after ACC-08. Signed in with this account. **People** page open, with no view applied.

- [ ] `FAFD` Open the **ID** column menu, and select **Freeze up to this column**.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `AF91` Scroll the table sideways to the right.
  - **Expected:**
    - **Name** and **ID** stay in place.
    - A thin grey line and a soft shadow are at the right of **ID**.
    - The other columns pass under them.
  - **Notes:**

- [ ] `D989` Scroll back to the left.
  - **Expected:** The table is back at its left end.
  - **Notes:**

- [ ] `22D8` Drag the right edge of the **Name** column's name to the right by about the width of the column.
  - **Expected:**
    - A short blue line shows on the edge.
    - **Name** widens with the pointer.
  - **Notes:**

- [ ] `BC20` Select **Position** in the header, then **Move right**.
  - **Expected:**
    - **Position** moves one place to the right.
    - No dot shows before its name.
    - No Publish button is in the top bar.
  - **Notes:**

- [ ] `7C12` Open the Views menu, and select **Save view…**.
  - **Expected:**
    - A dialog titled "Save view" shows **Name**.
    - Under **Includes**, it shows **Frozen** up to **ID**, **Column order** **Moved**, and **Widths** **Name**.
    - It offers no choice about sharing.
  - **Notes:**

- [ ] `3B23` Type `Fictional layout` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `B685` Select **Save view**.
  - **Expected:**
    - The dialog closes.
    - The Views button reads `Fictional layout`.
  - **Notes:**

- [ ] `C305` Open the Views menu, and select **Clear view**.
  - **Expected:**
    - Only **Name** stays in place when the table scrolls sideways.
    - **Position** is in its original place.
    - **Name** is at its original width.
  - **Notes:**

- [ ] `C860` Open the Views menu, and select `Fictional layout` under **My views**.
  - **Expected:**
    - **Name** and **ID** are frozen.
    - **Name** is about twice its original width.
    - **Position** is one place to the right of its original place.
  - **Notes:**

- [ ] `89C7` Open the Views menu, and select **Delete view**.
  - **Expected:**
    - A notice reads "Deleted the Fictional layout view."
    - The notice offers **Undo**.
  - **Notes:**

#### ACC-10: A Shared View Is Seen by Others Until It Is Taken Back

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, in the main browser, changed from ACC-09. The second browser signs in as another account in step `F3B1`.

**Preconditions:** Signed in with this account in the main browser. **People** page open, with no view applied.

- [ ] `36B5` Search for `el`.
  - **Expected:** Each row listed has `el` in one of its cells, in capitals or not.
  - **Notes:**

- [ ] `C002` Open the Views menu, and select **Save view…**.
  - **Expected:** The dialog shows a checkbox, **Share with everyone who sees this table**, not ticked, below **Name**.
  - **Notes:**

- [ ] `85D9` Type `Fictional hiring` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `CFEB` Tick **Share with everyone who sees this table**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `265A` Select **Save view**.
  - **Expected:**
    - The dialog closes.
    - The Views button reads `Fictional hiring`.
  - **Notes:**

- [ ] `891E` Open the Views menu.
  - **Expected:**
    - The heading **Shared views** is above `Fictional hiring`.
    - **Take back current view** is offered.
  - **Notes:**

- [ ] `F3B1` In the second browser, sign in as the Engineering Manager, `engineering.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Manager".
  - **Notes:**

- [ ] `4AF0` In the second browser, select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `229B` In the second browser, open the Views menu.
  - **Expected:** **Shared views** lists `Fictional hiring`.
  - **Notes:**

- [ ] `14F2` In the second browser, select `Fictional hiring`.
  - **Expected:** The search box shows `el`.
  - **Notes:**

- [ ] `BC69` In the second browser, open the Views menu again.
  - **Expected:** **Rename…**, **Delete view** and **Take back current view** are not offered.
  - **Notes:**

- [ ] `99E4` In the main browser, press Esc.
  - **Expected:** The Views menu closes.
  - **Notes:**

- [ ] `3B91` In the main browser, open the Views menu, and select **Take back current view**.
  - **Expected:**
    - A notice says "Took back the Fictional hiring view."
    - The notice offers **Undo**.
    - In the Views menu, `Fictional hiring` is under **My views**.
  - **Notes:**

- [ ] `AEF2` In the second browser, reload the page.
  - **Expected:** The **People** page opens again.
  - **Notes:**

- [ ] `C995` In the second browser, open the Views menu.
  - **Expected:** `Fictional hiring` is not listed.
  - **Notes:**

- [ ] `AEE5` In the main browser, open the Views menu, and select `Fictional hiring`.
  - **Expected:** The Views button reads `Fictional hiring`.
  - **Notes:**

- [ ] `170D` Open the Views menu, and select **Delete view**.
  - **Expected:** `Fictional hiring` is gone from the Views menu.
  - **Notes:**

### Journey 3: Org Chart and Feature Teams

#### ACC-11: A Team Member Reads the Org Chart

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-10.

**Preconditions:** Signed in with this account, in the main browser.

- [ ] `E5D8` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart shows each person's name, position, and the team they lead.
  - **Notes:**

- [ ] `62C8` Select the name on the card for 'Lorenza Thiel'.
  - **Expected:**
    - The details panel slides out on the right, headed 'Lorenza Thiel'.
    - The panel shows no pencils.
  - **Notes:**

- [ ] `BB88` Select the **Show only this team** button at the top right of the card for 'Lorenza Thiel'.
  - **Expected:**
    - 'Lorenza Thiel' is at the top of the chart.
    - Her reports are under her.
    - To the right of the heading, the page reads "Only the team of Lorenza Thiel is shown."
    - **Show everyone** is beside it.
  - **Notes:**

- [ ] `1DBB` Select **Show everyone**.
  - **Expected:**
    - 'Silje Holm-Schrøder' is at the top of the chart.
    - The line "Only the team of Lorenza Thiel is shown." is gone.
  - **Notes:**

- [ ] `67F5` In the finder, type `Gloria`, and select 'Gloria Armas Guardado'.
  - **Expected:**
    - The chart moves until the card for 'Gloria Armas Guardado' is in the middle of the panel.
    - A blue ring is around the card.
  - **Notes:**

- [ ] `C68D` Choose **Feature teams** in the teams switch.
  - **Expected:**
    - The chart shows four feature teams side by side, each first card naming its team:
      - 'Mobile apps'
      - 'Payments core'
      - 'Search and discovery', with a yellow dot before it
      - 'Platform reliability', with a grey lock before it
    - Above the chart, a line in grey reads "Other dates need Personal access."
    - There is no date control.
  - **Notes:**

- [ ] `DAD8` Choose **Reporting teams** in the teams switch.
  - **Expected:**
    - The chart shows managers' teams.
    - Above the chart, a line in grey reads "Other dates need Personal access."
    - There is no date control.
  - **Notes:**

#### ACC-12: An Engineering Manager Reads a Note Beside the Chart

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ACC-11.

**Preconditions:** Signed in with this account. **Org chart** page open from the left-hand menu.

- [ ] `11FE` On the card at the top of the chart, select the name 'Silje Holm-Schrøder'.
  - **Expected:**
    - The details panel slides out on the right, headed 'Silje Holm-Schrøder'.
    - The link **Show in People** is under her position.
    - The chart narrows.
    - Her card, with a blue ring, stays in the middle of the space left.
  - **Notes:**

- [ ] `4EB5` Select 'Tanushree Patel-Singh' under **Direct reports**, and read **Onboarding** under **Columns**.
  - **Expected:**
    - The panel shows 'Tanushree Patel-Singh'.
    - **Onboarding** shows the heading "First weeks".
    - Under the heading is a checklist of four steps, with only "Laptop and accounts ready" ticked.
    - In the checklist, the buddy's name 'Elly Gunther' is in bold.
    - Under the checklist, "On track" is in teal.
    - The last line ends with the link "onboarding guide".
  - **Notes:**

- [ ] `A189` Select the **×** at the top right of the panel.
  - **Expected:** The panel slides away.
  - **Notes:**

#### ACC-13: A Person Drafted to Another Manager Is Drawn in Both Places

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ACC-12.

**Preconditions:** **Org chart** page open, showing the top two levels.

- [ ] `804B` Read the card for 'Simone Jean', under 'Silje Holm-Schrøder'.
  - **Expected:**
    - The card is faintly yellow.
    - A yellow dot is before her name.
  - **Notes:**

- [ ] `EA88` On the card for 'Viktoria Holmberg', select **Show 3 reports**.
  - **Expected:**
    - 'Simone Jean', '우아현' and '西尾 亮' appear in a column under her.
    - The card for 'Simone Jean' there is faded and light green, with a dashed edge.
    - Its name is in grey, with a green dot before it.
    - The line to it is dashed.
  - **Notes:**

#### ACC-14: A Feature Lead Proposes a Lead and a Member

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, changed from ACC-13. Step `76A1` signs in as another account in the second browser.

**Preconditions:** Signed in with this account, acting as **Feature Lead**. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch.

- [ ] `DAF2` Select the Feature teams button, then 'Platform reliability'.
  - **Expected:**
    - The team panel opens, titled 'Platform reliability', with a grey lock before it.
    - Pointing at the lock shows "Being changed by Second Engineering Operations Manager".
    - No row has a change button.
  - **Notes:**

- [ ] `76A1` In the second browser, sign in as the Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`.
  - **Expected:** The top bar shows the **Publish** button.
  - **Notes:**

- [ ] `F276` In the second browser, run Discard the Unpublished Changes.
  - **Expected:**
    - A notice says "Discarded" followed by the number of changes.
    - The **Publish** button is gone.
  - **Notes:**

- [ ] `9C39` In the main browser, reload the page.
  - **Expected:**
    - The team panel is titled 'Platform reliability', with no lock.
    - **Feature lead** reads "None".
    - **Name**, **Feature lead** and **Members** each have a change button.
  - **Notes:**

- [ ] `62AD` Select the change button in the **Feature lead** row, type `Polly`, and press Enter.
  - **Expected:**
    - **Feature lead** reads 'Polly Smith', with a hollow yellow dot before it.
    - On the chart, the card reading 'Platform reliability' and "No feature lead" is gone.
    - The card of 'Polly Smith' is at the top of the team in its place.
    - 'Platform reliability' is under her position.
    - The team's members are under her.
  - **Notes:**

- [ ] `9A03` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `496D` Type `Rosendo`, and press Enter.
  - **Expected:** 'Rosendo Champlin' has a tick.
  - **Notes:**

- [ ] `34DE` Press Enter.
  - **Expected:**
    - **Members** lists 'Rosendo Champlin', with a hollow yellow dot before his name.
    - On the chart, a card for him is under 'Polly Smith', with a hollow yellow dot before his name.
    - His card in 'Mobile apps' is still there.
  - **Notes:**

- [ ] `20F5` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

#### ACC-15: A Project Manager Approves the Feature Team

**Account:** Project Manager, `project.manager@fathom.test`, changed from ACC-14.

**Preconditions:** ACC-14 done. Signed in with this account.

- [ ] `2C45` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `2EBA` Type `Platform reliability` in the search box.
  - **Expected:**
    - One entry is shown, "the feature team Platform reliability".
    - A line sets **Feature lead** to "Polly Smith".
    - A line for **Members** adds "Rosendo Champlin".
    - It was made by "Feature Lead".
  - **Notes:**

- [ ] `D2E4` Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `47EF` Select **Approve 1 draft**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `DC0A` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice begins "Approved".
  - **Notes:**

- [ ] `B3E6` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `CB16` Choose **Feature teams** in the teams switch.
  - **Expected:**
    - 'Platform reliability' is led by 'Polly Smith'.
    - 'Rosendo Champlin' is among the cards under her.
    - There are no dots.
  - **Notes:**

#### ACC-16: A Member Joins a Feature Team From an Earlier Date

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-15. Step `2A2C` signs in as another account.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] `F376` Select the left arrow once.
  - **Expected:**
    - The **Date** box shows the first day of last month.
    - Below the row, text reads "Showing" with that day, then "Changes take effect from this date."
  - **Notes:**

- [ ] `AD56` Select the Feature teams button, then 'Search and discovery'.
  - **Expected:**
    - The team panel is titled 'Search and discovery'.
    - **Name** reads 'Search and discovery', with a yellow dot before it.
    - Under it, 'Search', with a green dot before it.
  - **Notes:**

- [ ] `EE54` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `B930` Type `Branson`, and press Enter.
  - **Expected:** 'Branson O'Keefe' has a tick.
  - **Notes:**

- [ ] `08EB` Press Enter.
  - **Expected:**
    - **Members** lists 'Branson O'Keefe', with a hollow yellow dot before his name.
    - No date is after his name.
  - **Notes:**

- [ ] `CBE2` Select **Today**.
  - **Expected:**
    - The text below the row is gone.
    - In the team panel, 'Branson O'Keefe' has a hollow yellow dot before his name, followed in grey by "from" and the first day of last month.
  - **Notes:**

- [ ] `CA86` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `2A2C` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `4DCA` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `9AF6` Type `Branson` in the search box.
  - **Expected:**
    - One entry is listed, "the feature team Search and discovery".
    - Its **Members** line adds "Branson O'Keefe".
    - Its **Joining and leaving dates** line gives "Branson O'Keefe" and the first day of last month.
  - **Notes:**

- [ ] `F1BE` Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `BD38` Select **Approve 1 draft**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `9AD4` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice begins "Approved".
  - **Notes:**

#### ACC-17: Feature Assignments Show the Earlier Join

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-16.

**Preconditions:** ACC-16 done. Signed in with this account.

- [ ] `369C` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:**
    - The page is headed **Feature assignments**.
    - **Group by: Manager** is above the table.
    - The table has a **Person** column on the left.
    - The table has a column for each month, starting with the current month.
  - **Notes:**

- [ ] `E06A` Select **Feature team** in the Group by menu.
  - **Expected:**
    - The rows are grouped under the feature teams in order of name, then **No feature team**.
    - Each label names a feature team, in a box tinted with the team's colour, or grey for a team with none.
  - **Notes:**

- [ ] `264A` Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens.
  - **Notes:**

- [ ] `B755` Type `Branson`.
  - **Expected:**
    - Only 'Branson O'Keefe' is listed, under the 'Search and discovery' group.
    - His current month's cell holds a 'Search and discovery' label.
  - **Notes:**

- [ ] `9B41` Press Esc.
  - **Expected:** The filter closes.
  - **Notes:**

- [ ] `9F00` Scroll the table one month to the left.
  - **Expected:**
    - The **Person** column stays in place.
    - Last month's cell for 'Branson O'Keefe' holds a 'Search and discovery' label too.
    - The month before it holds no label.
  - **Notes:**

#### ACC-18: Allocations Show Each Month's Features and Their Totals

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ACC-17.

**Preconditions:** ACC-17 done.

- [ ] `1D47` Select the **Capacity** page in the left-hand menu.
  - **Expected:**
    - The mode switch has **People** chosen.
    - The table opens at the current month.
  - **Notes:**

- [ ] `5181` Select **Feature team** in the Group by menu.
  - **Expected:**
    - It is grouped by **Feature team**.
    - Cells list features, each on a line of its own with its percentage at the right, such as "50%".
  - **Notes:**

- [ ] `7E22` In the current month's column, find a cell that lists two features.
  - **Expected:**
    - Under the two features, a last line gives the two percentages added up, at the right.
    - A thin line above it sets it off.
  - **Notes:**

- [ ] `FBBB` In the current month's column, find a cell whose last line reads "Over", and one whose last line reads "Under".
  - **Expected:**
    - "Over" and its percentage are red and bold.
    - "Under" and its percentage are grey.
  - **Notes:**

#### ACC-19: The Feature Lead, Acting as Engineering Manager, Plans a Team Change in Feature Assignments

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-18.

**Preconditions:** ACC-16 done. Signed in with this account, acting as **Engineering Manager**. Select the **Feature assignments** page in the left-hand menu, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `3DCD` Type `Branson` in the search box.
  - **Expected:**
    - Only the row of 'Branson O'Keefe' is listed.
    - His current month's cell holds a 'Search and discovery' label.
  - **Notes:**

- [ ] `5E92` Select his cell two months after the current month, and press Enter.
  - **Expected:** The team list opens, with 'Search and discovery' shown as chosen.
  - **Notes:**

- [ ] `03CF` Type `Payments`, and press Tab.
  - **Expected:**
    - The team list closes.
    - From the cell selected on, each cell holds a 'Payments core' label with a hollow yellow dot before it, beside the 'Search and discovery' label.
    - The cells before the one selected hold only the 'Search and discovery' label, with no dot.
    - The row is faintly yellow.
    - A light green Live row is under it.
  - **Notes:**

- [ ] `DBC1` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `F5E0` Choose **Feature teams** in the teams switch.
  - **Expected:** The chart shows the feature teams side by side.
  - **Notes:**

- [ ] `D737` Select the Feature teams button, then 'Payments core'.
  - **Expected:**
    - The team panel is titled 'Payments core'.
    - 'Branson O'Keefe' is in the **Members** row, with a hollow yellow dot before his name.
    - His name is followed in grey by "from" and the first day of the month two months after the current one.
  - **Notes:**

#### ACC-20: A Team Member Has No Feature Assignments or Capacity Page

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-19.

**Preconditions:** Signed in with this account.

- [ ] `5318` Look at the **People** section of the left-hand menu.
  - **Expected:**
    - It shows **People**, **Org chart** and **Drafts**.
    - There is no **Feature assignments** and no **Capacity**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### Journey 4: The Plan

#### ACC-21: A Product Manager Adds a Customer, a Proposal and a Project With Milestones

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-20.

**Preconditions:** Restore the Seed Data run after ACC-20. Signed in with this account. **Projects** page open from the left-hand menu.

- [ ] `8F09` Select the **Customers** tab.
  - **Expected:** The **Customers** tab is selected.
  - **Notes:**

- [ ] `2E2F` Select **New customer**.
  - **Expected:** The side panel opens, headed **New customer**.
  - **Notes:**

- [ ] `0D40` Type `Fictional Ferry Co-op` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `79BF` Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before `Fictional Ferry Co-op`.
    - The table has a row for it, with a hollow yellow dot in its slot.
  - **Notes:**

- [ ] `70AF` Select the **Proposals** tab.
  - **Expected:** The **Proposals** tab is selected.
  - **Notes:**

- [ ] `90B4` Select **New proposal**.
  - **Expected:** The side panel opens, headed **New proposal**.
  - **Notes:**

- [ ] `CE3D` Type `Fictional Ferry Proposal` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `52A3` Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before `Fictional Ferry Proposal`.
    - **Status** reads "Open".
  - **Notes:**

- [ ] `6AB9` Select the **Projects** tab.
  - **Expected:** The **Projects** tab is selected.
  - **Notes:**

- [ ] `80B1` Select **New project**.
  - **Expected:** The side panel opens, headed **New project**.
  - **Notes:**

- [ ] `428B` Type `Fictional Harbour Lights` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `4B05` Type `FHL-1` in **Project ID**.
  - **Expected:** **Project ID** shows what was typed.
  - **Notes:**

- [ ] `33A4` Select the pencil button in the **Owner** row, and pick any person. Write the owner's name in the notes.
  - **Expected:** **Owner** shows the name picked.
  - **Notes:**

- [ ] `962A` Select the pencil button in the **Customers** row, and pick `Fictional Ferry Co-op`.
  - **Expected:** **Customers** shows `Fictional Ferry Co-op`.
  - **Notes:**

- [ ] `9C9C` Select the pencil button in the **Proposals** row, and pick `Fictional Ferry Proposal`.
  - **Expected:** **Proposals** shows `Fictional Ferry Proposal`.
  - **Notes:**

- [ ] `73F0` Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before `Fictional Harbour Lights`.
    - **First milestone**, **Last milestone** and **Next delivery** read "None".
    - Under **Milestones**, "No milestones yet" and an **Add milestone** button.
  - **Notes:**

- [ ] `659F` Select **Add milestone**.
  - **Expected:** A dialog titled "New milestone" opens.
  - **Notes:**

- [ ] `172F` Type `Pilot` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `CC76` Type `20300315` in **Date**.
  - **Expected:** **Date** shows the date typed.
  - **Notes:**

- [ ] `FE62` Tick **Customer delivery**.
  - **Expected:** **Customer delivery** is ticked.
  - **Notes:**

- [ ] `2A4D` Select **Add milestone** in the dialog.
  - **Expected:**
    - Under **Milestones**, a hollow yellow dot before `Pilot`.
    - Under `Pilot`, the date for `2030-03-15` and ", customer delivery".
  - **Notes:**

- [ ] `A3C4` Select **Add milestone**.
  - **Expected:** A dialog titled "New milestone" opens.
  - **Notes:**

- [ ] `886C` Type `Go live` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `D5E8` Type `20300630` in **Date**.
  - **Expected:** **Date** shows the date typed.
  - **Notes:**

- [ ] `43B4` Leave **Customer delivery** unticked, and select **Add milestone** in the dialog.
  - **Expected:**
    - `Go live` is listed after `Pilot`.
    - **First milestone** shows "2030-03-15".
    - **Last milestone** shows "2030-06-30".
    - **Next delivery** shows "2030-03-15".
    - The table's row for `Fictional Harbour Lights` shows "2030-03-15" as **First milestone**, "2030-06-30" as **Last milestone** and "2030-03-15" as **Next delivery**.
  - **Notes:**

- [ ] `8CE5` Run Publish.
  - **Expected:** The dots before the project and both milestones are now filled yellow.
  - **Notes:**

#### ACC-22: A Project Manager Approves the Project and Its Milestones

**Account:** Project Manager, `project.manager@fathom.test`, changed from ACC-21.

**Preconditions:** ACC-21 done. Signed in with this account. **Projects** page open, on the **Projects** tab.

- [ ] `2F40` Open the ⋯ menu of `Fictional Harbour Lights`, and select **Approve draft**.
  - **Expected:**
    - A dialog asks to approve the drafts.
    - Under "Also approves the drafts these depend on:", it lists "the proposal Fictional Ferry Proposal" and "the customer Fictional Ferry Co-op".
  - **Notes:**

- [ ] `D1D9` Select **Approve** in the dialog.
  - **Expected:** `Fictional Harbour Lights` has no dot.
  - **Notes:**

- [ ] `150E` Select the **Milestones** tab.
  - **Expected:**
    - The **Milestones** tab is selected.
    - The table of milestones is under the tab.
  - **Notes:**

- [ ] `FA29` Type `Fictional Harbour Lights` in the search box.
  - **Expected:** `Pilot` and `Go live` are listed, each with a yellow dot in its slot.
  - **Notes:**

- [ ] `76BA` Open the Draft menu.
  - **Expected:** The menu offers **Approve 2 drafts…**.
  - **Notes:**

- [ ] `5DBB` Select **Approve 2 drafts…**.
  - **Expected:** A dialog titled "Approve 2 drafts?" opens.
  - **Notes:**

- [ ] `22C1` Select **Approve** in the dialog.
  - **Expected:**
    - `Pilot` and `Go live` have no dots.
    - Each has `Fictional Harbour Lights` under **Project**, with `FHL-1` in grey before it.
  - **Notes:**

#### ACC-23: A Product Manager Adds a Feature With a Formatted Note

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-22. Step `C828` signs in as another account.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

- [ ] `4C9D` Select **New feature**.
  - **Expected:**
    - The **New feature** panel opens beside the table.
    - Labels are at the left of each row, under the headings **Details** and **Columns**.
    - The **Notes** row reads "None".
    - A pencil button is at the right of the **Notes** row.
  - **Notes:**

- [ ] `87FB` Type `Fictional Atlas` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `F6DB` Select the pencil button in the **Notes** row.
  - **Expected:**
    - A second panel opens under **New feature**, titled "Notes for New feature".
    - **Note**, **Editor** and **Markdown** are at its top.
    - **Editor** is chosen.
    - A toolbar is under the text.
  - **Notes:**

- [ ] `A31D` Type `Ferry routes first`.
  - **Expected:** The note shows what was typed.
  - **Notes:**

- [ ] `13B4` Select those words.
  - **Expected:** The words are highlighted.
  - **Notes:**

- [ ] `FD71` Select **Bold** in the toolbar.
  - **Expected:** The words are in bold.
  - **Notes:**

- [ ] `ED38` Select **Save** in the note's panel.
  - **Expected:**
    - The note's panel closes.
    - The **Notes** row shows `Ferry routes first` in bold.
    - **Name** still reads `Fictional Atlas`.
  - **Notes:**

- [ ] `D041` Select **Add** at the foot of the **New feature** panel.
  - **Expected:**
    - The feature's details show beside the table, headed with a hollow yellow dot before `Fictional Atlas`.
    - `Ferry routes first` is in bold under **Notes**.
  - **Notes:**

- [ ] `D82C` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `9D64` Reload the page.
  - **Expected:**
    - `Fictional Atlas` is under the heading **Later**.
    - Its row has a filled yellow dot in its slot.
  - **Notes:**

- [ ] `C828` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `08A4` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `A988` Open the ⋯ menu of `Fictional Atlas`, and select **Approve draft**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `49CE` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 1 draft."
    - `Fictional Atlas` has no dot.
  - **Notes:**

#### ACC-24: Leaving the New Feature Panel Asks First

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-23.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] `A31F` Select **New feature**.
  - **Expected:** The **New feature** panel opens beside the table.
  - **Notes:**

- [ ] `441A` Type `Fictional Compass` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `5C46` Select **Cancel** at the foot of the panel.
  - **Expected:**
    - A box asks "Discard the new feature?"
    - The box offers **Keep adding** and **Discard**.
  - **Notes:**

- [ ] `D802` Select **Keep adding**.
  - **Expected:**
    - The box closes.
    - **Name** still reads `Fictional Compass`.
  - **Notes:**

- [ ] `EA07` Select **Cancel**.
  - **Expected:** A box asks "Discard the new feature?"
  - **Notes:**

- [ ] `7B5C` Select **Discard**.
  - **Expected:**
    - The panel closes.
    - No row for `Fictional Compass` is in the table.
    - No Publish button is in the top bar.
  - **Notes:**

#### ACC-25: A Feature Linked From Features Is Found From Its Project

**Account:** Product Manager, `product.manager@fathom.test`, the same as ACC-24. Step `40DC` signs in as another account.

**Preconditions:** ACC-22 and ACC-23 done. **Features** page open.

- [ ] `DBA8` Select the **Projects** cell of `Fictional Atlas`, and press Enter.
  - **Expected:**
    - A list of projects opens, with a search box.
    - Each project is named by its ID, where it has one, then its name, such as `FHL-1 Fictional Harbour Lights`.
  - **Notes:**

- [ ] `D85F` Pick `FHL-1 Fictional Harbour Lights`, and press Enter.
  - **Expected:** The **Projects** cell names `Fictional Harbour Lights`, with `FHL-1` in grey before it.
  - **Notes:**

- [ ] `9CCD` Select the **Proposals** cell of `Fictional Atlas`, press Enter, pick `Fictional Ferry Proposal`, and press Enter.
  - **Expected:**
    - The **Proposals** cell names `Fictional Ferry Proposal`.
    - `Fictional Atlas` has no dot.
  - **Notes:**

- [ ] `FA37` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `40DC` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `1A2E` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `DA98` Type `Fictional` in the search box.
  - **Expected:**
    - Two entries are shown, one for the project `Fictional Harbour Lights` and one for the proposal `Fictional Ferry Proposal`.
    - Each entry has a checkbox.
  - **Notes:**

- [ ] `35CA` Select the checkbox of the entry for `Fictional Harbour Lights`.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `7D09` Select the checkbox of the entry for `Fictional Ferry Proposal`.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `55FF` Select **Approve 2 drafts**.
  - **Expected:** A dialog titled "Approve 2 drafts?" opens.
  - **Notes:**

- [ ] `945C` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 2 drafts."
  - **Notes:**

- [ ] `872C` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens.
  - **Notes:**

- [ ] `8A70` On the **Projects** tab, select **Show features** in the ⋯ menu of `Fictional Harbour Lights`.
  - **Expected:**
    - The **Features** page opens showing only `Fictional Atlas`.
    - A pill above the table reads "Projects: FHL-1 Fictional Harbour Lights".
  - **Notes:**

- [ ] `57DA` Select the **×** on the pill.
  - **Expected:** The pill is gone, and the table lists every feature.
  - **Notes:**

#### ACC-26: A Feature Status Is Added to Its List

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-25. Step `A33C` signs in as another account.

**Preconditions:** Signed in with this account. **Lists** page open from the left-hand menu.

- [ ] `04AC` Select **Feature statuses**.
  - **Expected:**
    - The panel opens with **Feature statuses** at the top.
    - A grey **Built in** box is after it.
    - Its choices are **Possible**, **Planned**, **In progress**, **Done** and **Cancelled**, each beside a meaning of the same name.
  - **Notes:**

- [ ] `963A` In the empty row's meaning menu, choose **Possible**.
  - **Expected:** The empty row's meaning menu reads "Possible".
  - **Notes:**

- [ ] `F7D1` Type `Long shot` in the empty row's **Name** box, and press Enter.
  - **Expected:**
    - A row `Long shot` appears above the empty row, with a hollow yellow dot in its slot.
    - "Possible" is at the end of the row.
  - **Notes:**

- [ ] `CCC8` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `A33C` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `1D01` Select the **Lists** page in the left-hand menu.
  - **Expected:** The **Lists** page opens.
  - **Notes:**

- [ ] `34EE` Select **Feature statuses**.
  - **Expected:** The panel opens with **Feature statuses** at the top.
  - **Notes:**

- [ ] `DAC6` Select the **⋯** button at the end of the `Long shot` row, then **Approve…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `F27E` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - `Long shot` has no dot.
  - **Notes:**

#### ACC-27: The Last Status for a Meaning Is Kept

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-26.

**Preconditions:** Signed in with this account. **Lists** page open, with the **Feature statuses** panel open.

- [ ] `9D42` Select the **⋯** button at the end of the **Cancelled** row.
  - **Expected:**
    - **Retire** and **Remove** are greyed out.
    - "Needed for Cancelled" is under them.
  - **Notes:**

- [ ] `0F39` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `6B24` Select the **⋯** button at the end of the **Possible** row.
  - **Expected:**
    - **Retire** can be selected.
    - No "Needed for" line is under it.
  - **Notes:**

- [ ] `B758` Press Esc.
  - **Expected:**
    - The menu closes.
    - Nothing has changed.
  - **Notes:**

#### ACC-28: A Feature Lead's Change Is Rejected With a Reason

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-27. Step `5AB9` signs in as another account.

**Preconditions:** ACC-26 done. Signed in with this account, acting as **Feature Lead**. **Features** page open.

- [ ] `189B` In the row 'Partner Portal', select the **Status** cell, press Enter, choose `Long shot`, and press Enter.
  - **Expected:**
    - The cell reads `Long shot`, with a hollow yellow dot before it.
    - The row is faintly yellow.
    - A Live row under it reads "Possible".
  - **Notes:**

- [ ] `67D2` Run Publish.
  - **Expected:** The dot before `Long shot` in the 'Partner Portal' row is filled yellow.
  - **Notes:**

- [ ] `5AB9` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Product Manager".
  - **Notes:**

- [ ] `FBED` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `312A` Open the ⋯ menu of 'Partner Portal'.
  - **Expected:**
    - The menu names the change to **Status**.
    - It offers **Approve draft** and **Reject draft…**.
  - **Notes:**

- [ ] `F5B3` Select **Reject draft…**.
  - **Expected:**
    - A dialog titled "Reject 1 draft?" opens.
    - It has a **Reason** box.
  - **Notes:**

- [ ] `EC9E` Type `Fictional reason: wait for the customer day.` in **Reason**.
  - **Expected:** **Reason** shows what was typed.
  - **Notes:**

- [ ] `55A4` Select **Reject**.
  - **Expected:**
    - A notice reads "Rejected 1 draft."
    - In the 'Partner Portal' row, `Long shot` has a red dot in a ring before it.
    - The row is faintly red.
  - **Notes:**

#### ACC-29: A Rejected Change Is Resubmitted and Approved

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-28. Step `4F03` signs in as another account.

**Preconditions:** ACC-28 done. Signed in with this account, acting as **Feature Lead**. **Features** page open.

- [ ] `1ADD` Open the ⋯ menu of 'Partner Portal'.
  - **Expected:**
    - The menu shows a red dot in a ring, then "Rejected".
    - Under it, "Reason: Fictional reason: wait for the customer day."
    - The menu offers **Resubmit** and **Discard draft**.
  - **Notes:**

- [ ] `6A10` Select **Resubmit**.
  - **Expected:**
    - The dot before `Long shot` is solid yellow.
    - The row is faintly yellow.
  - **Notes:**

- [ ] `4F03` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Product Manager".
  - **Notes:**

- [ ] `3F3E` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `65C0` Type `Partner Portal` in the search box.
  - **Expected:**
    - One entry is shown, for the feature 'Partner Portal'.
    - It was made by "Feature Lead".
    - It has a checkbox.
  - **Notes:**

- [ ] `DDD3` Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `F240` Select **Approve 1 draft**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `AD8D` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 1 draft."
    - The page says "No drafts match the search."
  - **Notes:**

- [ ] `AFA2` Select **Features**.
  - **Expected:**
    - 'Partner Portal' reads `Long shot` in **Status**.
    - It has no dot.
  - **Notes:**

#### ACC-30: The Change History Tells How a Draft Went

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from ACC-29.

**Preconditions:** ACC-29 done. Signed in with this account.

- [ ] `ABF7` Select the **Change history** page in the left-hand menu.
  - **Expected:** The **Change history** page opens.
  - **Notes:**

- [ ] `E6DA` Type `Partner Portal` in the search box.
  - **Expected:** The entries, newest first, say that:
    - "Product Manager" approved the changes to 'Partner Portal'
    - "Feature Lead" sent its draft for approval again
    - "Product Manager" rejected its draft, with the reason "Fictional reason: wait for the customer day."
    - "Feature Lead" drafted changing **Status** from "Possible" to `Long shot`
  - **Notes:**

#### ACC-31: A Shorter Cycle Moves a Release and Its Features

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, in the main browser, changed from ACC-30. The second browser is still signed in as the Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, from ACC-14; steps `63FA` and `572B` act there. Step `0EDF` signs in as another account in the main browser.

**Preconditions:** Signed in with this account. **Releases** page open from the left-hand menu, with 'Platform' selected in the streams table.

- [ ] `6A3F` Look at the side panel's heading and its **Cycles** table.
  - **Expected:**
    - The heading reads 'Platform', with a grey lock before it.
    - The rows of the **Cycles** table have no **⋯** button.
  - **Notes:**

- [ ] `63FA` In the second browser, reload the page.
  - **Expected:** The top bar shows the Publish button.
  - **Notes:**

- [ ] `572B` In the second browser, run Discard the Unpublished Changes.
  - **Expected:**
    - A notice says "Discarded" followed by the number of changes.
    - The Publish button is gone.
  - **Notes:**

- [ ] `537F` In the main browser, reload the page.
  - **Expected:**
    - The side panel's heading reads 'Platform'.
    - No lock is before it.
  - **Notes:**

- [ ] `E757` In the side panel's **Cycles** table, select the **⋯** button at the end of next quarter's cycle, then **Change length…**.
  - **Expected:**
    - A dialog titled "Change the length of" that cycle opens.
    - **Length** reads "3", followed by "months".
    - Under **Later cycles**, **Move with it** is selected.
  - **Notes:**

- [ ] `A8A7` Replace `3` in **Length** with `2`.
  - **Expected:**
    - **New dates** lists that cycle two months long.
    - Each later cycle in **New dates** starts the day after the one before it ends.
    - **Releases that move** names 'Harbor 3' and 'Harbor 4'.
    - **Features that move** names 'Data Retention Controls' and 'Report Builder'.
  - **Notes:**

- [ ] `5B2C` Select **Change length**.
  - **Expected:** A notification says "Drafted the new length."
  - **Notes:**

- [ ] `563B` Run Publish.
  - **Expected:** Under **Releases**, in the 'Harbor 3' row:
    - A yellow dot in its slot, then 'Harbor 3' and the yellow **Moved** box
    - Its cycles run from the cycle after next quarter's to the second half-year cycle
    - It ships on the second half-year cycle's new last day
  - **Notes:**

- [ ] `0EDF` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `1EC6` Select the **Releases** page in the left-hand menu.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] `F3E0` Select 'Platform' in the streams table.
  - **Expected:** The side panel's heading reads 'Platform'.
  - **Notes:**

- [ ] `AACC` Select the **⋯** button at the end of the 'Harbor 3' row, then **Approve…**.
  - **Expected:** A dialog titled "Approve 6 drafts?" says "Also approves the drafts these depend on:", listing:
    - Three entries for "the cycles of Platform from" a day
    - "the feature Data Retention Controls"
    - "the feature Report Builder"
  - **Notes:**

- [ ] `3EAA` Select **Approve**.
  - **Expected:**
    - A notification says "Approved 6 drafts."
    - No row under **Cycle schedule** has a dot.
    - 'Harbor 3' has no dot and no box.
    - 'Harbor 3' still ships on the second half-year cycle's new last day.
  - **Notes:**

#### ACC-32: A Product Manager Makes a Release

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-31. Step `3DB5` signs in as another account.

**Preconditions:** Signed in with this account. **Releases** page open from the left-hand menu, with 'Platform' selected in the streams table.

- [ ] `38DB` Select **New release…** under **Releases** in the side panel.
  - **Expected:**
    - A dialog titled "New release in Platform" opens.
    - It has **Name**, **First cycle**, **Last cycle** and an empty **Ships on**.
  - **Notes:**

- [ ] `B1A8` Type `Fictional Harbor 4` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `1FE0` Choose the last cycle in the list in **First cycle**.
  - **Expected:** **First cycle** shows the cycle chosen.
  - **Notes:**

- [ ] `D146` Choose the last cycle in the list in **Last cycle**.
  - **Expected:** Under **Ships on**, the dialog reads "Leave empty to ship at the end of its last cycle, on" that cycle's last day.
  - **Notes:**

- [ ] `C642` Select **Make release**.
  - **Expected:** A notification says "Drafted the new release."
  - **Notes:**

- [ ] `FF3E` Run Publish.
  - **Expected:** Under **Releases**, a row reads `Fictional Harbor 4`, with a yellow dot in its slot.
  - **Notes:**

- [ ] `3DB5` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `119A` Select the **Releases** page in the left-hand menu.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] `3F69` Select 'Platform' in the streams table.
  - **Expected:** The side panel's heading reads 'Platform'.
  - **Notes:**

- [ ] `5E58` Select the **⋯** button at the end of the `Fictional Harbor 4` row, then **Approve…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `B441` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - `Fictional Harbor 4` has no dot.
  - **Notes:**

#### ACC-33: An Executive Reads the Plan

**Account:** Executive, `executive@fathom.test`, changed from ACC-32.

**Preconditions:** ACC-32 done. Signed in with this account.

- [ ] `4CE3` Look at the page and the left-hand menu.
  - **Expected:**
    - The **Overview** page is open.
    - The **Plan** section shows **Overview**, **Projects**, **Features** and **Releases**.
    - The **People** section shows **People**, **Org chart**, **Feature assignments**, **Drafts**, **Capacity** and **Lists**.
    - The **Administration** section shows **Accounts**, **Roles** and **Settings**.
    - The **History** section shows **Change history** and **Access history**.
    - The menu shows the **Help** section.
  - **Notes:**

- [ ] `723D` Select **Releases**.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] `7DFE` Select 'Platform' in the streams table.
  - **Expected:**
    - There is no **New release stream** button.
    - There is no **New release…** button.
    - 'Harbor 1', 'Harbor 3' and `Fictional Harbor 4` have no **⋯** button at their end.
  - **Notes:**

- [ ] `7C20` Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `D30B` Select **All** on the timeline.
  - **Expected:**
    - The whole timeline fits across.
    - `Fictional Harbor 4` is at the right end of the releases lane of 'Platform'.
    - A diamond is under the right end of `Fictional Harbor 4`.
  - **Notes:**

- [ ] `52F5` Hover over `Fictional Harbor 4`'s span.
  - **Expected:** A tooltip names `Fictional Harbor 4`, its cycle and the day it ships.
  - **Notes:**

- [ ] `3A6C` Select **Features**.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `6CF3` Select **Group by: Cycle** above the table, then **Needed by**.
  - **Expected:**
    - Each heading names a month and year, such as **Mar 2027**, with how many features it holds.
    - The headings run from the earliest month to the latest.
    - The last heading is **No date**.
    - There is no **New feature** button.
  - **Notes:**

- [ ] `A584` Select **Group by: Needed by**, then **Cycle**.
  - **Expected:** The headings name cycles, with **Later** last.
  - **Notes:**

#### ACC-34: An Executive Sees People and Administration Without Changing Them

**Account:** Executive, `executive@fathom.test`, the same as ACC-33.

**Preconditions:** Signed in with this account.

- [ ] `98E3` Select **People**.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `4A2E` Search for `Chatura Abbott`.
  - **Expected:**
    - Her row is shown, with a date after today in **Start**.
    - The table has **Start** and **End** columns.
    - There is no **New** and no **New column** button.
  - **Notes:**

- [ ] `CAC5` Select **Drafts**.
  - **Expected:**
    - Drafts are listed, with no checkboxes.
    - There is no **Select all waiting** or **Approve** button.
  - **Notes:**

- [ ] `4B61` Select **Accounts**.
  - **Expected:**
    - Every account is in the table with its roles.
    - There is no **New account** button.
    - There is no **Edit** button in any row.
  - **Notes:**

#### ACC-35: A Team Member Reads the Plan Without Changing It

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-34.

**Preconditions:** Signed in with this account.

- [ ] `83BF` Look at the left-hand menu.
  - **Expected:**
    - The **Plan** section shows **Overview**, **Projects**, **Features** and **Releases**.
    - The **People** section shows **People**, **Org chart**, **Feature assignments** and **Drafts**.
    - The **History** section shows **Change history**.
    - The menu shows the **Help** section.
  - **Notes:**

- [ ] `8C54` Select **Features**.
  - **Expected:**
    - The table shows `Fictional Atlas` and 'Partner Portal' reading `Long shot`.
    - There is no **New feature** button.
    - There is no empty row at the table's end.
  - **Notes:**

- [ ] `7DB7` Double-click the **Status** cell of any row.
  - **Expected:** The cell does not open for editing.
  - **Notes:**

- [ ] `5D0B` Select **Releases**.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] `9A61` Select 'Platform' in the streams table.
  - **Expected:**
    - `Fictional Harbor 4` is under **Releases**.
    - 'Harbor 1', 'Harbor 3' and `Fictional Harbor 4` have no **⋯** button.
    - There is no **New release…** button.
  - **Notes:**

#### ACC-36: Removing a Project Removes Its Milestones

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-35. Step `EB87` signs in as another account.

**Preconditions:** ACC-22 done. Signed in with this account. **Projects** page open, on the **Projects** tab.

- [ ] `6A2C` Open the ⋯ menu of `Fictional Harbour Lights`, and select **Remove project**.
  - **Expected:**
    - `Fictional Harbour Lights` has a hollow yellow dot in its slot.
    - Its row is struck through.
  - **Notes:**

- [ ] `C9BE` Run Publish.
  - **Expected:** The dot is filled yellow.
  - **Notes:**

- [ ] `EB87` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `34A2` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens.
  - **Notes:**

- [ ] `AEA6` Open the ⋯ menu of `Fictional Harbour Lights`, and select **Approve draft**.
  - **Expected:**
    - The dialog names the removal of "the project Fictional Harbour Lights".
    - As drafts it includes, it names the removal of `Pilot` and `Go live`.
  - **Notes:**

- [ ] `E15A` Select **Approve** in the dialog.
  - **Expected:** `Fictional Harbour Lights` is no longer listed.
  - **Notes:**

- [ ] `A939` Select the **Milestones** tab.
  - **Expected:** `Pilot` and `Go live` of `Fictional Harbour Lights` are no longer listed.
  - **Notes:**

### Journey 5: Administration

#### ACC-37: A New Account Signs In for the First Time

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, changed from ACC-36. The second browser signs in as the new account in step `BC14`.

**Preconditions:** Signed in with this account in the main browser.

- [ ] `6BF5` Look at the left-hand menu.
  - **Expected:**
    - The **Administration** section shows **Accounts**, **Roles** and **Settings**.
    - The **History** section shows **Access history**.
    - The menu shows the **Help** section.
    - It shows no page of the plan or of people.
  - **Notes:**

- [ ] `A38F` Select **Accounts**.
  - **Expected:** The **Accounts** page opens.
  - **Notes:**

- [ ] `FD38` Select **New account**.
  - **Expected:**
    - A dialog titled "New account" opens.
    - **Name** and **Email address** are empty.
    - **Roles** lists every role, each with a square tick box and its description.
    - Only **Team Member** is ticked.
  - **Notes:**

- [ ] `2DE6` Type `Fictional Newcomer` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `E7AF` Type `fictional.newcomer@fathom.test` in **Email address**.
  - **Expected:** **Email address** shows what was typed.
  - **Notes:**

- [ ] `DF8E` Select **Create account**.
  - **Expected:** The dialog, titled "Password for Fictional Newcomer", says "This password is shown only once. Fictional Newcomer must change it at the next sign-in."
  - **Notes:**

- [ ] `A55E` Select the eye button, and write the password down.
  - **Expected:** The eye button shows the password.
  - **Notes:**

- [ ] `0C1C` Select **Done**.
  - **Expected:**
    - A green banner says "Created the account for Fictional Newcomer."
    - The table has a `Fictional Newcomer` row with **Team Member** in **Roles**.
  - **Notes:**

- [ ] `BC14` In the second browser, sign out if signed in, and sign in as the new account, `fictional.newcomer@fathom.test`, with the password written down.
  - **Expected:**
    - A panel headed **Change password** says "Fathom generated this password. A new password is required to continue."
    - There is no left-hand menu.
  - **Notes:**

- [ ] `8E0E` Enter the password written down in **Current password**.
  - **Expected:** **Current password** is filled in.
  - **Notes:**

- [ ] `FCE5` Enter `fictional password 2` in **New password**.
  - **Expected:** **New password** is filled in.
  - **Notes:**

- [ ] `9C94` Enter `fictional password 2` in **New password again**.
  - **Expected:** **New password again** is filled in.
  - **Notes:**

- [ ] `160A` Select **Change password**.
  - **Expected:**
    - A green banner says "The password has been changed, and every other session has been signed out."
    - Fathom opens on the **Overview**.
    - The left-hand menu is shown.
  - **Notes:**

#### ACC-38: A Copied Role Is Given to the New Account

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ACC-37. The second browser stays signed in as the new account.

**Preconditions:** ACC-37 done. **Roles** page open from the left-hand menu.

- [ ] `AFE7` Select **Copy** in the **Team Member** row.
  - **Expected:**
    - A dialog titled "Copy Team Member" opens.
    - The name reads "Copy of Team Member".
    - **View** is ticked on **Plan**, **Features and releases**, **Allocations**, **People** and **Feature teams**.
    - Its main button is **Create role**.
  - **Notes:**

- [ ] `F492` Replace the name with `Fictional Reader`.
  - **Expected:** The name reads `Fictional Reader`.
  - **Notes:**

- [ ] `420A` Tick **View** on **Configuration**.
  - **Expected:** **View** on **Configuration** is ticked.
  - **Notes:**

- [ ] `FB50` Select **Create role**.
  - **Expected:**
    - A green banner says "The role has been created."
    - `Fictional Reader` is in the list with 0 accounts.
  - **Notes:**

- [ ] `066A` Select **Accounts** in the left-hand menu.
  - **Expected:** The **Accounts** page opens, with a `Fictional Newcomer` row.
  - **Notes:**

- [ ] `A74D` Select **Edit** in the `Fictional Newcomer` row.
  - **Expected:** A dialog titled "Edit Fictional Newcomer" opens, with only **Team Member** ticked.
  - **Notes:**

- [ ] `D862` Tick `Fictional Reader`.
  - **Expected:** `Fictional Reader` is ticked.
  - **Notes:**

- [ ] `3C07` Untick **Team Member**.
  - **Expected:** **Team Member** is not ticked.
  - **Notes:**

- [ ] `DC03` Select **Save**.
  - **Expected:**
    - A green banner says "Saved the account for Fictional Newcomer."
    - The row's **Roles** cell shows `Fictional Reader`.
  - **Notes:**

- [ ] `5D1B` In the second browser, reload the page.
  - **Expected:** The left-hand menu shows **Lists** in the **People** section.
  - **Notes:**

#### ACC-39: Restore Template Brings Back a Starting Role

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ACC-38.

**Preconditions:** **Roles** page open.

- [ ] `CFBF` Select **Edit** in the **Executive** row.
  - **Expected:** The role dialog opens.
  - **Notes:**

- [ ] `F434` Tick **Edit** on the **Plan** row.
  - **Expected:**
    - **Description** reads "Sees the plan, people, with their Personal and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them."
    - **Restore template** is turned on.
  - **Notes:**

- [ ] `F0D2` Select **Restore template**.
  - **Expected:**
    - **Edit** on **Plan** is unticked.
    - **Restore template** is turned off.
  - **Notes:**

- [ ] `9EBB` Select **Cancel**.
  - **Expected:**
    - The dialog closes.
    - The **Executive** row's description reads "Sees the plan, people, with their Personal and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them."
  - **Notes:**

#### ACC-40: A Deactivated Account Is Signed Out, Then Reactivated

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ACC-39. The second browser stays signed in as the new account.

**Preconditions:** ACC-38 done. **Accounts** page open.

- [ ] `096E` Select **Edit** in the `Fictional Newcomer` row.
  - **Expected:** A dialog titled "Edit Fictional Newcomer" opens.
  - **Notes:**

- [ ] `CC99` Select **Deactivate**.
  - **Expected:**
    - A dialog titled "Deactivate Fictional Newcomer" says "Fictional Newcomer will be signed out everywhere, and will not be able to sign in until the account is reactivated."
    - It offers **Cancel** and a red **Deactivate**.
  - **Notes:**

- [ ] `E2DE` Select **Deactivate**.
  - **Expected:**
    - A green banner says "Deactivated the account for Fictional Newcomer."
    - The row says "Deactivated", in grey.
  - **Notes:**

- [ ] `F8D7` In the second browser, select any page in the left-hand menu.
  - **Expected:** The **Sign in** page opens.
  - **Notes:**

- [ ] `B703` In the main browser, select **Deactivated 1** in the filter beside the search box.
  - **Expected:** Only the `Fictional Newcomer` row is listed.
  - **Notes:**

- [ ] `3B2E` Select **Edit** in the `Fictional Newcomer` row.
  - **Expected:** A dialog titled "Edit Fictional Newcomer" opens.
  - **Notes:**

- [ ] `FACA` Select **Reactivate**.
  - **Expected:** A dialog opens with a **Reactivate** button.
  - **Notes:**

- [ ] `D3CC` Select **Reactivate** in the dialog.
  - **Expected:**
    - A green banner says "Reactivated the account for Fictional Newcomer."
    - The filter reads "Deactivated 0".
  - **Notes:**

- [ ] `DB1D` In the second browser, sign in as the new account, `fictional.newcomer@fathom.test`, with `fictional password 2`.
  - **Expected:**
    - Fathom opens.
    - **Change history** is in the left-hand menu.
  - **Notes:**

#### ACC-41: The Access History Records What Was Done to the Account

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ACC-40.

**Preconditions:** ACC-37 to ACC-40 done.

- [ ] `0A88` Select the **Access history** page in the left-hand menu.
  - **Expected:** The **Access history** page opens.
  - **Notes:**

- [ ] `4E6C` Type `Fictional Newcomer` in the search box at the top of the page.
  - **Expected:** The entries include, from newest to oldest:
    - "Fathom Administrator" "reactivated the account for" `Fictional Newcomer`
    - "Fathom Administrator" "deactivated the account for" `Fictional Newcomer`, marked as worth checking
    - "Fathom Administrator" "changed the role of" `Fictional Newcomer`, "from Team Member to Fictional Reader", marked as worth checking
    - `Fictional Newcomer` "changed their own password"
    - "Fathom Administrator" "created the account for" `Fictional Newcomer`
  - **Notes:**

#### ACC-42: Switching Role Changes What Can Be Done at Once

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, changed from ACC-41.

**Preconditions:** Signed in with this account, acting as **Feature Lead**. **Releases** page open, with 'Platform' selected in the streams table.

- [ ] `95E5` Open the account menu.
  - **Expected:**
    - **Role** lists **Engineering Manager** and **Feature Lead**.
    - A tick is beside **Feature Lead** only.
  - **Notes:**

- [ ] `A523` Press Esc, and look under **Releases** in the side panel.
  - **Expected:**
    - 'Harbor 1', 'Harbor 3' and `Fictional Harbor 4` have no **⋯** button.
    - There is no **New release…** button.
  - **Notes:**

- [ ] `FDE2` Choose **Engineering Manager** in the role menu.
  - **Expected:**
    - The menu closes.
    - The page stays on **Releases** with 'Platform' open, without the browser reloading.
    - Each row under **Releases** now ends with a **⋯** button.
    - **New release…** shows.
  - **Notes:**

#### ACC-43: The Change History Names the Role a Change Was Made As

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, the same as ACC-42.

**Preconditions:** ACC-42 done, acting as **Engineering Manager**. **Releases** page open, with 'Platform' selected in the streams table.

- [ ] `2E35` Select the **⋯** button at the end of the 'Harbor 3' row, then **Change…**.
  - **Expected:**
    - A dialog titled "Change Harbor 3" opens.
    - **Name** holds 'Harbor 3'.
  - **Notes:**

- [ ] `507D` Replace the name with `Fictional Harbor Three`.
  - **Expected:** **Name** holds `Fictional Harbor Three`.
  - **Notes:**

- [ ] `DE68` Select **Save**.
  - **Expected:**
    - A notification says "Drafted the change to the release."
    - The row reads `Fictional Harbor Three`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `CB6B` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `DC52` Select the **Change history** page in the left-hand menu.
  - **Expected:**
    - The latest entry names `Fictional Harbor Three`.
    - It starts with "Feature Lead as Engineering Manager".
  - **Notes:**

- [ ] `E452` Select **Releases**.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] `D9AF` Select 'Platform' in the streams table.
  - **Expected:** The side panel's heading reads 'Platform'.
  - **Notes:**

- [ ] `BB58` Select the **⋯** button at the end of the `Fictional Harbor Three` row, then **Discard draft**.
  - **Expected:**
    - A notification says "Discarded the draft."
    - The row reads 'Harbor 3', with no dot.
  - **Notes:**

- [ ] `04D0` Choose **Feature Lead** in the role menu.
  - **Expected:** 'Harbor 1', 'Harbor 3' and `Fictional Harbor 4` have no **⋯** button.
  - **Notes:**

#### ACC-44: Each Browser Keeps Its Own Appearance

Covered by the [Dark Mode](dark-mode-manual-test.md) manual test.

#### ACC-45: Put Everything Back

**Account:** Administrator, `fathom.administrator@fathom.test`, changed from ACC-43. Step `B5CA` signs in again with this account.

**Preconditions:** All the test cases above run.

- [ ] `B5CA` Run Reset the Database, signing in again as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** The top bar's right end reads "Fathom Administrator".
  - **Notes:**

- [ ] `F887` Select the **Accounts** page in the left-hand menu.
  - **Expected:** The table lists the development accounts, with no `Fictional Newcomer`.
  - **Notes:**

- [ ] `428A` Select the **Roles** page in the left-hand menu.
  - **Expected:**
    - The roles are listed as [Roles](../product/roles.md#starting-roles) sets out.
    - The **Superuser** role is listed.
    - There is no `Fictional Reader`.
  - **Notes:**

### Journey 6: An Organization Starts From Nothing

#### ACC-46: The Administrator Adds an Account With Two Roles

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ACC-45.

**Preconditions:** Start From an Empty Database run. Signed in with this account.

- [ ] `734C` Select the **Accounts** page in the left-hand menu.
  - **Expected:**
    - The table lists the development accounts, as [Development Setup](../design/development-setup.md#development-accounts) lists them, and no other.
    - The filter beside the search box reads "All 12", "Active 12" and "Deactivated 0".
  - **Notes:**

- [ ] `4B6E` Select **New account**.
  - **Expected:** A dialog titled "New account" opens.
  - **Notes:**

- [ ] `0EA3` Type `Fictional Planning Lead` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `B9C8` Type `fictional.planning.lead@fathom.test` in **Email address**.
  - **Expected:** **Email address** shows what was typed.
  - **Notes:**

- [ ] `1BB6` Under **Roles**, tick **Product Manager**.
  - **Expected:**
    - **Product Manager** is ticked.
    - **Default role** is under the roles.
  - **Notes:**

- [ ] `EF4E` Tick **Workforce Administrator**.
  - **Expected:** **Workforce Administrator** is ticked.
  - **Notes:**

- [ ] `10F7` Untick **Team Member**.
  - **Expected:** **Default role** offers **Product Manager** and **Workforce Administrator**, in the order of the role list.
  - **Notes:**

- [ ] `BE70` Choose **Workforce Administrator** under **Default role**.
  - **Expected:** **Workforce Administrator** is chosen under **Default role**.
  - **Notes:**

- [ ] `769F` Select **Create account**.
  - **Expected:** The dialog is titled "Password for Fictional Planning Lead".
  - **Notes:**

- [ ] `D6BB` Select the eye button, and write the password down.
  - **Expected:** The eye button shows the password.
  - **Notes:**

- [ ] `2C7B` Select **Done**.
  - **Expected:**
    - A green banner says "Created the account for Fictional Planning Lead."
    - The row's **Roles** cell shows **Workforce Administrator (default)** then **Product Manager**.
  - **Notes:**

#### ACC-47: People Are Pasted Into an Empty People Table and Approved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-46. Step `83E3` signs in as another account.

**Preconditions:** ACC-46 done. Signed in with this account. In the text editor, seven lines, typed with the Tab key where shown:

- `Odile Brandt`, Tab, `EMP-100`, Tab, `Manager`, Tab, `Hired`
- `Ada Quill`, Tab, `EMP-101`, Tab, `Manager`, Tab, `Hired`
- `Bram Oakes`, Tab, `EMP-102`, Tab, `Employee`, Tab, `Hired`
- `Cleo Marsh`, Tab, `EMP-103`, Tab, `Employee`, Tab, `Hired`
- `Dara Finch`, Tab, `EMP-104`, Tab, `Employee`, Tab, `Hired`
- `Emil Stone`, Tab, `EMP-105`, Tab, `Employee`, Tab, `Hired`
- `Freya Holt`, Tab, `EMP-106`, Tab, `Employee`, Tab, `Hired`

- [ ] `589D` Select the **People** page in the left-hand menu.
  - **Expected:**
    - The table has its column names and only the empty row.
    - The count above the table reads "0 people".
  - **Notes:**

- [ ] `9D63` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The page reads "Nobody is on the org chart yet."
  - **Notes:**

- [ ] `F312` Select the **Change history** page in the left-hand menu.
  - **Expected:** The page reads "No changes yet to data this account can see."
  - **Notes:**

- [ ] `E567` Select **People**.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `2C0F` Copy the seven lines from the text editor.
  - **Expected:** The seven lines are highlighted in the text editor.
  - **Notes:**

- [ ] `14CF` In Fathom, select the **Name** cell of the empty row.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `49C3` Paste.
  - **Expected:**
    - Seven rows are added, one for each line.
    - Each row has its ID.
    - Each row reads `Manager` or `Employee` in **Position**.
    - Each row reads `Hired` in **State**.
    - Each row has a hollow yellow dot in its slot.
    - The count reads "7 people".
  - **Notes:**

- [ ] `E018` Click once in the **Manager?** cell of `Odile Brandt`.
  - **Expected:** Her box is checked.
  - **Notes:**

- [ ] `FB00` Click once in the **Manager?** cell of `Ada Quill`.
  - **Expected:**
    - Both boxes are checked.
    - The other rows' boxes stay clear.
  - **Notes:**

- [ ] `2B67` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `83E3` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `FE50` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `A5E6` Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 7 drafts**.
  - **Notes:**

- [ ] `6FA2` Select **Approve 7 drafts**.
  - **Expected:** A dialog titled "Approve 7 drafts?" opens.
  - **Notes:**

- [ ] `E674` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 7 drafts."
    - The page says "No drafts waiting for approval."
  - **Notes:**

#### ACC-48: Reporting Lines and a Planned Hire Are Added

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-47. Step `2E1D` signs in as another account.

**Preconditions:** ACC-47 done. Signed in with this account. **People** page open.

- [ ] `C588` Select the **Manager** cell of `Bram Oakes`, press Enter, type `Ada`, and choose `Ada Quill`.
  - **Expected:**
    - The **Manager** cell reads `Ada Quill`, with a hollow yellow dot before it.
    - **Manager assigned** holds today's date.
  - **Notes:**

- [ ] `3BB2` Select the **Manager** cell of `Cleo Marsh`, press Enter, type `Ada`, and choose `Ada Quill`.
  - **Expected:** The **Manager** cell of `Cleo Marsh` reads `Ada Quill`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `B5C2` Select the **Manager** cell of `Freya Holt`, press Enter, type `Ada`, and choose `Ada Quill`.
  - **Expected:** The **Manager** cell of `Freya Holt` reads `Ada Quill`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `054C` Select the **Manager** cell of `Ada Quill`, press Enter, type `Odile`, and choose `Odile Brandt`.
  - **Expected:** The **Manager** cell of `Ada Quill` reads `Odile Brandt`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `3E56` Select the **Manager** cell of `Dara Finch`, press Enter, type `Odile`, and choose `Odile Brandt`.
  - **Expected:** The **Manager** cell of `Dara Finch` reads `Odile Brandt`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `CD87` Select the **Manager** cell of `Emil Stone`, press Enter, type `Odile`, and choose `Odile Brandt`.
  - **Expected:**
    - Each of the six rows reads its new manager, with a hollow yellow dot before it.
    - `Odile Brandt` has no manager.
  - **Notes:**

- [ ] `564E` Select **New** at the top right of the page.
  - **Expected:** The details panel opens, headed **New person**.
  - **Notes:**

- [ ] `97D3` Select the change button beside **State**, and choose **Request to hire**.
  - **Expected:** **State** reads "Request to hire".
  - **Notes:**

- [ ] `7C2B` Type `Fictional tide engineer` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `15E7` Type `REQ-7001` in **ID**.
  - **Expected:** **ID** shows what was typed.
  - **Notes:**

- [ ] `970E` Type the first day of three months from now in **Start**, such as `20270201`.
  - **Expected:** **Start** shows the date typed.
  - **Notes:**

- [ ] `DC04` Choose **Employee** in **Position** from its change button.
  - **Expected:** **Position** reads "Employee".
  - **Notes:**

- [ ] `F63E` Choose `Ada Quill` in **Manager** from its change button.
  - **Expected:** **Manager** reads `Ada Quill`.
  - **Notes:**

- [ ] `35BF` Select **Add**.
  - **Expected:**
    - The panel shows `Fictional tide engineer`.
    - Its row reads "Request to hire" in **State** and `Ada Quill` in **Manager**.
    - Its row has a hollow yellow dot in its slot.
  - **Notes:**

- [ ] `71A5` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `2E1D` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `9A27` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `5B3B` Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 7 drafts**.
  - **Notes:**

- [ ] `EEF7` Select **Approve 7 drafts**.
  - **Expected:** A dialog titled "Approve 7 drafts?" opens.
  - **Notes:**

- [ ] `CC83` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 7 drafts."
    - The page says "No drafts waiting for approval."
  - **Notes:**

#### ACC-49: A Team Member Reads the New Organization

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-48.

**Preconditions:** ACC-48 done. Signed in with this account.

- [ ] `A9E9` Select the **Org chart** page in the left-hand menu.
  - **Expected:**
    - `Odile Brandt` is at the top, with `Manager` under the name.
    - Her card ends with "Hide 3 reports".
    - `Dara Finch` and `Emil Stone` are in a column under her.
    - `Ada Quill`, with `Manager` under the name, is to the right of that column.
    - Her card ends with "Show 4 reports".
  - **Notes:**

- [ ] `D6EE` On the card for `Ada Quill`, select **Show 4 reports**.
  - **Expected:**
    - `Bram Oakes`, `Cleo Marsh` and `Freya Holt` appear in a column under her.
    - After them is a card with a grey dashed edge for `Fictional tide engineer`.
    - On that card, "Employee" is under the name.
    - On that card, under "Employee", a grey box reads "Planned, expected" and the month three months from now.
  - **Notes:**

- [ ] `4DA1` Choose **Feature teams** in the teams switch.
  - **Expected:** The Feature teams button shows above the chart.
  - **Notes:**

- [ ] `863B` Select the Feature teams button.
  - **Expected:**
    - The menu reads "No feature teams yet".
    - It offers no **New feature team**.
  - **Notes:**

#### ACC-50: The Planning Lead Sets Up a Release Stream and Makes a Release

**Account:** Planning lead, `fictional.planning.lead@fathom.test`, changed from ACC-49.

**Preconditions:** ACC-46 done. Signed out.

- [ ] `5B98` Sign in as the planning lead, with the password written down in ACC-46.
  - **Expected:** A panel headed **Change password** says "Fathom generated this password. A new password is required to continue."
  - **Notes:**

- [ ] `D427` Enter the password written down in **Current password**.
  - **Expected:** **Current password** is filled in.
  - **Notes:**

- [ ] `B751` Enter `fictional password 3` in **New password**.
  - **Expected:** **New password** is filled in.
  - **Notes:**

- [ ] `FA62` Enter `fictional password 3` in **New password again**.
  - **Expected:** **New password again** is filled in.
  - **Notes:**

- [ ] `743B` Select **Change password**.
  - **Expected:**
    - A green banner says "The password has been changed, and every other session has been signed out."
    - Fathom opens with the left-hand menu.
  - **Notes:**

- [ ] `C990` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The page reads "No release streams yet."
    - A **New release stream** button is at the top right.
  - **Notes:**

- [ ] `2A4A` Select **New release stream**.
  - **Expected:** A dialog titled "New release stream" opens.
  - **Notes:**

- [ ] `55CC` Type `Fictional Mainline` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `FD5B` Select **Add stream**.
  - **Expected:**
    - A notification says "Drafted the new release stream."
    - The side panel is headed with a hollow yellow dot before `Fictional Mainline`.
    - "No cycles yet." is under **Cycle schedule**.
    - "No releases yet." is under **Releases**.
    - There is no **New release…** button.
  - **Notes:**

- [ ] `BC71` Select **Set up cycles…**.
  - **Expected:** A dialog titled "Set up cycles for Fictional Mainline" opens.
  - **Notes:**

- [ ] `46F8` Type `20270101` in **First cycle starts**, leaving **Each cycle lasts** at `3`, **Months**, and **Names** at `{YY}.{N}`.
  - **Expected:**
    - Under **First cycles**, the first row reads "27.1", "2027-01-01 to 2027-03-31".
    - The second row reads "27.2", "2027-04-01 to 2027-06-30".
    - The third row reads "27.3", "2027-07-01 to 2027-09-30".
  - **Notes:**

- [ ] `C0C7` Select **Set up cycles**.
  - **Expected:** A notification says "Drafted the cycles."
  - **Notes:**

- [ ] `7C37` Run Publish.
  - **Expected:** Under **Cycle schedule**, a row reads "From 2027-01-01", then "Every 3 months, named {YY}.{N}".
  - **Notes:**

- [ ] `18D1` Choose **Product Manager** in the role menu.
  - **Expected:**
    - The page stays on **Releases**, with `Fictional Mainline` open.
    - **New release…** shows under **Releases**.
  - **Notes:**

- [ ] `0C3D` Select **New release…**.
  - **Expected:** A dialog titled "New release in Fictional Mainline" opens.
  - **Notes:**

- [ ] `E634` Type `Fictional Mainline 1` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `38FE` Choose **27.1 (2027-01-01 to 2027-03-31)** as the first cycle.
  - **Expected:** **First cycle** shows the cycle chosen.
  - **Notes:**

- [ ] `0D2F` Choose **27.2 (2027-04-01 to 2027-06-30)** as the last cycle.
  - **Expected:** **Last cycle** shows the cycle chosen.
  - **Notes:**

- [ ] `233E` Type `20270615` in **Ships on**.
  - **Expected:** Under **Ships on**, the dialog reads "Ships 15 days before 27.2 ends".
  - **Notes:**

- [ ] `3C03` Select **Make release**.
  - **Expected:** A notification says "Drafted the new release."
  - **Notes:**

- [ ] `2CD8` Run Publish.
  - **Expected:**
    - Under **Releases**, a row reads `Fictional Mainline 1`, with a yellow dot in its slot.
    - The row then reads "27.1 to 27.2 · ships 2027-06-15", followed in bold by "15 days before 27.2 ends".
  - **Notes:**

#### ACC-51: A Product Manager Starts the Plan

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-50.

**Preconditions:** ACC-48 done. Signed in with this account.

- [ ] `D681` Select the **Projects** page in the left-hand menu.
  - **Expected:**
    - The **Projects** tab is chosen.
    - The table has only its empty row.
    - The count above it reads "0 projects".
  - **Notes:**

- [ ] `BE26` Select the **Customers** tab.
  - **Expected:** The **Customers** tab is selected.
  - **Notes:**

- [ ] `49C1` Select the **Name** cell of the empty row, type `Fictional Lighthouse Trust`, and press Enter.
  - **Expected:**
    - A row `Fictional Lighthouse Trust` is added, with a hollow yellow dot in its slot.
    - A new empty row is under it.
  - **Notes:**

- [ ] `B829` Select the **Proposals** tab.
  - **Expected:** The **Proposals** tab is selected.
  - **Notes:**

- [ ] `46D1` Select **New proposal**.
  - **Expected:** The side panel opens, headed **New proposal**.
  - **Notes:**

- [ ] `B262` Type `Fictional Lighthouse Bid` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `E7B1` Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before `Fictional Lighthouse Bid`.
    - **Status** reads "Open".
  - **Notes:**

- [ ] `32F5` Select the **Projects** tab.
  - **Expected:** The **Projects** tab is selected.
  - **Notes:**

- [ ] `1B6E` Select **New project**.
  - **Expected:** The side panel opens, headed **New project**.
  - **Notes:**

- [ ] `F879` Type `Fictional Lamp Room` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `0B37` Type `FLR-1` in **Project ID**.
  - **Expected:** **Project ID** shows what was typed.
  - **Notes:**

- [ ] `B848` Select the pencil button in the **Owner** row, and pick `Ada Quill`.
  - **Expected:** **Owner** shows `Ada Quill`.
  - **Notes:**

- [ ] `607E` Select the pencil button in the **Customers** row, and pick `Fictional Lighthouse Trust`.
  - **Expected:** **Customers** shows `Fictional Lighthouse Trust`.
  - **Notes:**

- [ ] `A3C5` Select the pencil button in the **Proposals** row, and pick `Fictional Lighthouse Bid`.
  - **Expected:** **Proposals** shows `Fictional Lighthouse Bid`.
  - **Notes:**

- [ ] `F0FE` Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before `Fictional Lamp Room`.
    - Under **Milestones**, it reads "No milestones yet".
  - **Notes:**

- [ ] `94DB` Select the **Features** page in the left-hand menu.
  - **Expected:**
    - The table has no group headings.
    - The table has only its empty row.
    - The count above it reads "0 features".
  - **Notes:**

- [ ] `DC9C` Select **New feature**.
  - **Expected:** The **New feature** panel opens beside the table.
  - **Notes:**

- [ ] `5EB4` Type `Fictional Tide Tables` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `958E` Select the pencil button in the **Status** row, and choose **Planned**.
  - **Expected:** **Status** shows "Planned".
  - **Notes:**

- [ ] `C4B0` Select the pencil button in the **Customers** row, and choose `Fictional Lighthouse Trust`.
  - **Expected:** **Customers** shows `Fictional Lighthouse Trust`.
  - **Notes:**

- [ ] `7B69` Select **Add**.
  - **Expected:**
    - The feature's details are headed with a hollow yellow dot before `Fictional Tide Tables`.
    - In the table, its **Feature team** cell shows a red **No team** box.
  - **Notes:**

- [ ] `47DB` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

#### ACC-52: A Project Manager Approves the Plan and the Release Together

**Account:** Project Manager, `project.manager@fathom.test`, changed from ACC-51.

**Preconditions:** ACC-50 and ACC-51 done. Signed in with this account.

- [ ] `6C42` Select the **Drafts** page in the left-hand menu.
  - **Expected:** Seven entries are shown, each with a checkbox, one each for:
    - the release stream `Fictional Mainline`
    - its cycles from "2027-01-01"
    - the release `Fictional Mainline 1`
    - the customer `Fictional Lighthouse Trust`
    - the proposal `Fictional Lighthouse Bid`
    - the project `Fictional Lamp Room`
    - the feature `Fictional Tide Tables`
  - **Notes:**

- [ ] `6CFD` Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 7 drafts**.
  - **Notes:**

- [ ] `655C` Select **Approve 7 drafts**.
  - **Expected:** A dialog titled "Approve 7 drafts?" opens.
  - **Notes:**

- [ ] `5BB4` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 7 drafts."
    - The page says "No drafts waiting for approval."
  - **Notes:**

- [ ] `3C39` Select **Releases**.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] `F456` Select `Fictional Mainline` in the streams table.
  - **Expected:**
    - No row in the side panel has a dot.
    - `Fictional Mainline 1` still ships on "2027-06-15", "15 days before 27.2 ends".
  - **Notes:**

#### ACC-53: Feature Teams Are Recorded From Six Months Ago

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-52. Step `D62C` signs in as another account.

**Preconditions:** ACC-48 done. Signed in with this account.

- [ ] `4B09` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The page is headed **Feature assignments**.
  - **Notes:**

- [ ] `6ACD` Select **Feature team** in the Group by menu.
  - **Expected:**
    - Every person is listed under **No feature team**.
    - No cell in any month holds a label.
  - **Notes:**

- [ ] `3E43` Select the **Org chart** page in the left-hand menu.
  - **Expected:**
    - The chart opens.
    - The **Date** box shows today.
  - **Notes:**

- [ ] `3BD9` Choose **Feature teams** in the teams switch.
  - **Expected:** **Feature teams** is chosen in the teams switch.
  - **Notes:**

- [ ] `BEB3` Clear the **Date** box, type the first day of six months ago, such as `20260501`, and press Enter.
  - **Expected:** Below the date row, text reads "Showing" and that day, such as "Showing May 1, 2026.", then "Changes take effect from this date."
  - **Notes:**

- [ ] `9E28` Select the Feature teams button.
  - **Expected:**
    - The menu reads "No feature teams yet".
    - Under it is **New feature team**.
  - **Notes:**

- [ ] `1E9E` Select **New feature team**.
  - **Expected:**
    - A panel titled **New feature team** opens.
    - A **Details** section has a **Name** row with an empty box.
    - A **Members** section has the rows **Feature lead** and **Members**, each with a change button.
    - **Cancel** and **Add** are at the foot.
  - **Notes:**

- [ ] `8D60` Type `Tide team` in the **Name** box.
  - **Expected:** The **Name** box holds `Tide team`.
  - **Notes:**

- [ ] `57EB` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `717F` Type `Ada`, and press Enter.
  - **Expected:** `Ada Quill` has a tick.
  - **Notes:**

- [ ] `E415` Type `Bram`, and press Enter.
  - **Expected:** `Bram Oakes` has a tick.
  - **Notes:**

- [ ] `57BC` Type `Cleo`, and press Enter.
  - **Expected:** `Cleo Marsh` has a tick.
  - **Notes:**

- [ ] `F8BF` Press Enter.
  - **Expected:** **Members** lists `Ada Quill`, `Bram Oakes` and `Cleo Marsh`, one to a line.
  - **Notes:**

- [ ] `7F8A` Select **Add**.
  - **Expected:**
    - The panel is titled `Tide team`, with a hollow yellow dot before it.
    - **Members** lists `Ada Quill`, `Bram Oakes` and `Cleo Marsh`, each with a hollow yellow dot before the name.
    - No date is after any of the names.
    - On the chart, a card named `Tide team` reads "No feature lead".
  - **Notes:**

- [ ] `FF5B` Select the Feature teams button, then **New feature team**.
  - **Expected:** A panel titled **New feature team** opens.
  - **Notes:**

- [ ] `B4E2` Type `Harbour team` in the **Name** box.
  - **Expected:** The **Name** box holds `Harbour team`.
  - **Notes:**

- [ ] `4C0F` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `A2E3` Type `Dara`, and press Enter.
  - **Expected:** `Dara Finch` has a tick.
  - **Notes:**

- [ ] `E4B6` Type `Emil`, and press Enter.
  - **Expected:** `Emil Stone` has a tick.
  - **Notes:**

- [ ] `35EA` Press Enter.
  - **Expected:** **Members** lists `Dara Finch` and `Emil Stone`, one to a line.
  - **Notes:**

- [ ] `7E85` Select the change button in the **Feature lead** row, type `Dara`, and press Enter.
  - **Expected:** **Feature lead** reads `Dara Finch`.
  - **Notes:**

- [ ] `7A76` Select **Add**.
  - **Expected:**
    - The panel is titled `Harbour team`, with a hollow yellow dot before it.
    - **Feature lead** reads `Dara Finch`.
    - **Members** lists `Dara Finch` and `Emil Stone`.
  - **Notes:**

- [ ] `3F4A` Select the Feature teams button, then **New feature team**.
  - **Expected:** A panel titled **New feature team** opens.
  - **Notes:**

- [ ] `A034` Type `Beacon team` in the **Name** box.
  - **Expected:** The **Name** box holds `Beacon team`.
  - **Notes:**

- [ ] `8DAD` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `2B4C` Type `Cleo`.
  - **Expected:** `Cleo Marsh` is listed.
  - **Notes:**

- [ ] `0ADF` Press Enter.
  - **Expected:** `Cleo Marsh` has a tick.
  - **Notes:**

- [ ] `F2C3` Type `Freya`, and press Enter.
  - **Expected:** `Freya Holt` has a tick.
  - **Notes:**

- [ ] `3B47` Press Enter.
  - **Expected:** **Members** lists `Cleo Marsh` and `Freya Holt`, one to a line.
  - **Notes:**

- [ ] `5F40` Select **Add**.
  - **Expected:**
    - The panel is titled `Beacon team`, with a hollow yellow dot before it.
    - On the chart, a card for `Cleo Marsh` is under `Tide team`.
    - Another card for `Cleo Marsh` is under `Beacon team`.
  - **Notes:**

- [ ] `BE73` Select **Today**.
  - **Expected:**
    - The text below the row is gone.
    - `Tide team` has `Ada Quill`, `Bram Oakes` and `Cleo Marsh` under its card.
    - `Harbour team`'s first card is `Dara Finch`'s, with `Emil Stone` under it.
    - `Beacon team` has `Cleo Marsh` and `Freya Holt` under its card.
  - **Notes:**

- [ ] `0C64` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `D62C` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `BD9B` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `F842` Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 3 drafts**.
  - **Notes:**

- [ ] `30A0` Select **Approve 3 drafts**.
  - **Expected:** A dialog titled "Approve 3 drafts?" opens.
  - **Notes:**

- [ ] `37C8` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 3 drafts."
  - **Notes:**

#### ACC-54: The Feature Lead, Acting as Engineering Manager, Plans Team Changes Months Ahead

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-53. Step `4FF5` signs in as another account.

**Preconditions:** ACC-53 done. Signed in with this account, acting as **Engineering Manager**. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] `727D` Select the right arrow once.
  - **Expected:** Text below the row reads "Showing" with the first day of next month, such as "Showing Dec 1, 2026.", then "Changes take effect from this date."
  - **Notes:**

- [ ] `CB84` Select the Feature teams button, then `Tide team`.
  - **Expected:** The team panel is titled `Tide team`.
  - **Notes:**

- [ ] `FA46` Select the change button in the **Feature lead** row, type `Ada`, and press Enter.
  - **Expected:**
    - **Feature lead** reads `Ada Quill`, with a hollow yellow dot before it.
    - Under it, a green dot before "None", in grey.
  - **Notes:**

- [ ] `DD2C` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `875E` Type `Bram`, and press Enter to untick `Bram Oakes`.
  - **Expected:** `Bram Oakes` has no tick.
  - **Notes:**

- [ ] `682E` Press Enter.
  - **Expected:**
    - **Members** lists `Ada Quill`, `Bram Oakes` and `Cleo Marsh`.
    - A hollow yellow dot is before `Bram Oakes`.
    - `Bram Oakes` is struck through.
  - **Notes:**

- [ ] `93A3` Select the Feature teams button, then `Harbour team`.
  - **Expected:** The team panel is titled `Harbour team`.
  - **Notes:**

- [ ] `4D92` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `07F8` Type `Bram`, and press Enter.
  - **Expected:** `Bram Oakes` has a tick.
  - **Notes:**

- [ ] `4AA0` Press Enter.
  - **Expected:**
    - **Members** lists `Bram Oakes`.
    - A hollow yellow dot is before his name.
  - **Notes:**

- [ ] `77F5` Select the right arrow twice.
  - **Expected:** Text below the row reads "Showing" with the first day of the month three months from now, such as "Showing Feb 1, 2027."
  - **Notes:**

- [ ] `4C70` Select the Feature teams button, then `Beacon team`.
  - **Expected:** The team panel is titled `Beacon team`.
  - **Notes:**

- [ ] `111D` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `F3EA` Type `Cleo`, and press Enter to untick `Cleo Marsh`.
  - **Expected:** `Cleo Marsh` has no tick.
  - **Notes:**

- [ ] `A5DD` Type `Freya`, and press Enter to untick `Freya Holt`.
  - **Expected:** `Freya Holt` has no tick.
  - **Notes:**

- [ ] `B494` Press Enter.
  - **Expected:**
    - **Members** lists `Cleo Marsh` and `Freya Holt`.
    - Each has a hollow yellow dot before the name.
    - Each name is struck through.
  - **Notes:**

- [ ] `44D9` Select **Today**.
  - **Expected:** The text below the row is gone.
  - **Notes:**

- [ ] `832C` Select the Feature teams button, then `Tide team`.
  - **Expected:**
    - In the **Members** row, `Bram Oakes` has a hollow yellow dot before his name.
    - His name is struck through.
    - It is followed in grey by "from" and the first day of next month.
  - **Notes:**

- [ ] `C869` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `4FF5` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `B822` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `2ED1` Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 3 drafts**.
  - **Notes:**

- [ ] `9D85` Select **Approve 3 drafts**.
  - **Expected:** A dialog titled "Approve 3 drafts?" opens.
  - **Notes:**

- [ ] `4BC8` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 3 drafts."
  - **Notes:**

#### ACC-55: The Org Chart Shows Each Team Month by Month

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-54.

**Preconditions:** ACC-54 done. Signed in with this account. **Org chart** page open, with **Feature teams** chosen in the teams switch, showing today.

- [ ] `C7EE` Read the chart.
  - **Expected:**
    - A card named `Tide team` reads "No feature lead", with `Ada Quill`, `Bram Oakes` and `Cleo Marsh` under it.
    - `Dara Finch`'s card is named `Harbour team`, with `Emil Stone` under it.
    - A card named `Beacon team` reads "No feature lead", with `Cleo Marsh` and `Freya Holt` under it.
  - **Notes:**

- [ ] `416A` Clear the date box, type the first day of six months ago, such as `20260501`, and press Enter.
  - **Expected:**
    - Below the row, text reads "Showing" and that day, such as "Showing May 1, 2026.", then "Changes take effect from this date."
    - A card named `Tide team` reads "No feature lead", with `Ada Quill`, `Bram Oakes` and `Cleo Marsh` under it.
    - `Dara Finch`'s card is named `Harbour team`, with `Emil Stone` under it.
    - A card named `Beacon team` reads "No feature lead", with `Cleo Marsh` and `Freya Holt` under it.
  - **Notes:**

- [ ] `D0FA` Select **Today**.
  - **Expected:** The text below the row is gone.
  - **Notes:**

- [ ] `6FD2` Select the right arrow once.
  - **Expected:**
    - The date box shows the first day of next month.
    - `Ada Quill`'s card is named `Tide team`, with `Cleo Marsh` under it.
    - `Bram Oakes` and `Emil Stone` are under `Harbour team`.
    - A card named `Beacon team` reads "No feature lead", with `Cleo Marsh` and `Freya Holt` under it.
  - **Notes:**

- [ ] `C1B6` Select the right arrow twice.
  - **Expected:**
    - The date box shows the first day of three months from now.
    - Only `Tide team` and `Harbour team` are drawn.
    - No card names `Beacon team`.
  - **Notes:**

- [ ] `F071` Select **Today**.
  - **Expected:**
    - The text below the row goes.
    - A card named `Tide team` reads "No feature lead", with `Ada Quill`, `Bram Oakes` and `Cleo Marsh` under it.
    - `Dara Finch`'s card is named `Harbour team`, with `Emil Stone` under it.
    - A card named `Beacon team` reads "No feature lead", with `Cleo Marsh` and `Freya Holt` under it.
  - **Notes:**

#### ACC-56: Feature Assignments Show the Changes by Month

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ACC-55.

**Preconditions:** ACC-54 done. Signed in with this account.

- [ ] `29AD` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The page is headed **Feature assignments**.
  - **Notes:**

- [ ] `CCDB` Select **Feature team** in the Group by menu.
  - **Expected:**
    - The groups are `Beacon team`, `Harbour team`, `Tide team` and **No feature team**, in that order.
    - `Odile Brandt` is under **No feature team**.
  - **Notes:**

- [ ] `02FA` Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens.
  - **Notes:**

- [ ] `D453` Type `Bram`.
  - **Expected:** Only `Bram Oakes`'s rows are listed.
  - **Notes:**

- [ ] `A799` Press Esc.
  - **Expected:**
    - `Bram Oakes` is listed under `Harbour team` and under `Tide team`.
    - In each of his rows, the current month's cell holds a `Tide team` label.
    - In each of his rows, next month's cell holds a `Harbour team` label.
  - **Notes:**

- [ ] `5C18` Scroll the table to the left until the column for seven months ago is in view, and read one of `Bram Oakes`'s rows from left to right.
  - **Expected:**
    - The cell for seven months ago holds no label.
    - From six months ago to the current month, each cell holds a `Tide team` label.
    - From next month on, each holds a `Harbour team` label.
  - **Notes:**

- [ ] `1FE3` Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens, holding `Bram`.
  - **Notes:**

- [ ] `243F` Replace `Bram` with `Cleo`.
  - **Expected:** Only `Cleo Marsh`'s rows are listed.
  - **Notes:**

- [ ] `1D95` Press Esc, and read `Cleo Marsh`'s rows from left to right.
  - **Expected:**
    - From six months ago to two months from now, `Cleo Marsh`'s cells hold a `Beacon team` label and a `Tide team` label.
    - From three months from now on, `Cleo Marsh`'s cells hold only `Tide team`.
  - **Notes:**

- [ ] `AB3B` Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens, holding `Cleo`.
  - **Notes:**

- [ ] `330C` Replace `Cleo` with `Freya`.
  - **Expected:** Only `Freya Holt`'s rows are listed.
  - **Notes:**

- [ ] `C6BD` Press Esc, and read `Freya Holt`'s rows from left to right.
  - **Expected:**
    - `Freya Holt`'s cells hold a `Beacon team` label from six months ago to two months from now.
    - `Freya Holt`'s cells hold no label from three months from now on.
  - **Notes:**

#### ACC-57: A Feature Lead Gives the Feature Its Team and Cycle

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-56. Step `37AA` signs in as another account.

**Preconditions:** ACC-52 and ACC-53 done. Signed in with this account, acting as **Feature Lead**. **Features** page open.

- [ ] `B982` Select the **Feature team** cell of `Fictional Tide Tables`, and press Enter.
  - **Expected:** The choices are `Beacon team`, `Harbour team` and `Tide team`.
  - **Notes:**

- [ ] `427E` Choose `Tide team`, and press Enter.
  - **Expected:**
    - The cell reads `Tide team`, with a hollow yellow dot before it.
    - The **No team** box is gone.
    - The row is faintly yellow.
    - A Live row is under it.
  - **Notes:**

- [ ] `4B36` Select the row's **Target cycle** cell, press Enter, choose **Fictional Mainline: 27.1**, and press Enter.
  - **Expected:** The cell reads "Fictional Mainline: 27.1", with a hollow yellow dot before it.
  - **Notes:**

- [ ] `F097` Run Publish.
  - **Expected:**
    - The cell reads "Fictional Mainline: 27.1", with a filled yellow dot before it.
    - The dot before `Tide team` is filled yellow too.
  - **Notes:**

- [ ] `37AA` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Product Manager".
  - **Notes:**

- [ ] `E107` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `706A` Open the **⋯** menu of `Fictional Tide Tables`, and select **Approve draft**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `0D01` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 1 draft."
    - `Fictional Tide Tables` has no dot.
    - It reads `Tide team` in **Feature team**.
    - It is under the heading **Fictional Mainline: 27.1**.
  - **Notes:**

**Afterwards:** Run Reset the Database.
