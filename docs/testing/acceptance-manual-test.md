---
title: "Manual Test: End-to-End Acceptance"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/product/roles.md"]
last_updated: "2026-11-11"
---

# Manual Test: End-to-End Acceptance

## Scope

Verifies Fathom's common use by every persona in [Roles](../product/roles.md#roles-by-persona), in journeys that pass work from one account to the next: hiring and People, saved views, the org chart, feature teams and feature assignments, the plan from projects to releases, administration, and an organization setting Fathom up from an empty database, with feature teams recorded from months ago and planned months ahead. Each feature is run once as it is usually used and once in a less usual way. The feature manual tests in `docs/testing/` cover each feature in depth.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A browser window at least 1,440 pixels wide, on a computer whose appearance can be switched between light and dark.
- A second browser, or a private window, for signing in as a second account while the first stays signed in.
- A plain text editor, for typing lines to copy and paste into a table.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses the account of each persona in [Roles](../product/roles.md#roles-by-persona):

- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`
- **Engineering Manager:** `engineering.manager@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`, holding the Feature Lead role, its default, and the Engineering Manager role
- **Engineering Director:** `engineering.director@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as **Second Engineering Operations Manager**
- **Executive:** `executive@fathom.test`
- **Team Member:** `team.member@fathom.test`
- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as **Fathom Administrator**

This test creates:

- **New account:** `fictional.newcomer@fathom.test`, shown in Fathom as **Fictional Newcomer**. ACC-37 creates it with the Team Member role, and its password is the one ACC-37 shows, until ACC-37 changes it to `fictional password 2`. ACC-38 gives it the **Fictional Reader** role in place of Team Member.
- **Planning lead account:** `fictional.planning.lead@fathom.test`, shown in Fathom as **Fictional Planning Lead**. ACC-46 creates it with the Workforce Administrator role, its default, and the Product Manager role, and its password is the one ACC-46 shows, until ACC-50 changes it to `fictional password 3`.

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Start From an Empty Database](manual-test-basics.md#start-from-an-empty-database), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the account menu, marks, the lock, boxes, a row's slot, Draft rows and Live rows, the Publish button, the finder, the teams switch, the team panel and seeded dates. This test adds:

- **Seeded dates in this test:** **Next quarter's cycle** is the Platform stream's cycle for the quarter after the one today is in. The examples after "such as" are as the seed data is when added in November 2026.
- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20300315`.
- **Months from today:** the steps name months by where they fall from the current month: **last month** is the one before it, **next month** the one after it, a number of **months ago**, such as **six months ago**, that many months before it, and **three months from now** the third month after it. The steps type a month's first day as digits; the examples after "such as" are for a run in November 2026, such as `20260501` for the first day of six months ago.
- **Empty row:** the row at the end of a table, with blank cells, where a new record is typed or pasted.
- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**. Accounts that don't see Personal details have the arrows, timeline and **Today** without it.

## Test Cases

Run the test cases in order, in about three and a half hours: two hours and 50 minutes for Journeys 1 to 5, and 40 minutes for Journey 6. Start with Start Fathom, then Reset the Database; Journey 6 starts again with Start From an Empty Database, and the last test case runs Reset the Database to put everything back. Check each step whose expected result you see, and write anything else under its notes.

### Journey 1: Hiring and People

#### ACC-01: A Planned Hire Is Added and Approved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step 8 signs in as another account.

**Preconditions:** Reset the Database run. **Light** chosen in the Appearance menu. Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Select **New** at the top right of the page.
  - **Expected:** The details panel opens, headed **New person**.
  - **Notes:**

- [ ] **Step 2.** Select the change button beside **State**, and choose **Request to hire**.
  - **Expected:** The details panel is headed **New planned hire**.
  - **Notes:**

- [ ] **Step 3.** Type `Fictional mobile tester` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 4.** Type `REQ-5001` in **ID**.
  - **Expected:** **ID** shows what was typed.
  - **Notes:**

- [ ] **Step 5.** Choose **SDET** in **Position** from its change button.
  - **Expected:** **Position** reads **SDET**.
  - **Notes:**

- [ ] **Step 6.** Select **Add**.
  - **Expected:**
    - The panel shows **Fictional mobile tester**.
    - Its row in the table has a hollow yellow dot in its slot.
    - The row reads **Request to hire** in **State**.
  - **Notes:**

- [ ] **Step 7.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 8.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] **Step 9.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 10.** Type `REQ-5001` in the search box.
  - **Expected:**
    - One entry is shown, adding the planned hire **Fictional mobile tester**.
    - The entry has a checkbox.
  - **Notes:**

- [ ] **Step 11.** Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 12.** Select **Approve 1 draft**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 13.** Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 14.** Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] **Step 15.** Search for `Fictional mobile tester`.
  - **Expected:**
    - One hire row is shown, with no dot.
    - It reads **REQ-5001** in **ID**.
    - It reads **SDET** in **Position**.
    - It reads **Request to hire** in **State**.
  - **Notes:**

#### ACC-02: Someone Who Has Not Started Is Listed Only for Those Who See Personal Details

**Account:** Product Manager, `product.manager@fathom.test`, changed from the account ACC-01 ended with. Step 2 signs in as another account.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Search for `Chatura Abbott`.
  - **Expected:**
    - No row is shown.
    - The table has no **Start** or **End** column.
  - **Notes:**

- [ ] **Step 2.** Sign out, and sign in as the Engineering Manager, `engineering.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Manager**.
  - **Notes:**

- [ ] **Step 3.** Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] **Step 4.** Search for `Chatura Abbott`.
  - **Expected:** One row, for **Chatura Abbott**, whose **Start** cell holds a date after today.
  - **Notes:**

- [ ] **Step 5.** Select the row's details button.
  - **Expected:**
    - The details panel is headed **Chatura Abbott**.
    - **Start** under **Details** shows a date after today.
  - **Notes:**

#### ACC-03: A Planned Hire Is Filled With a New Person

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-02. Step 8 signs in as another account.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] **Step 1.** Search for `Backend engineer 2`.
  - **Expected:** A row for **Backend engineer 2** is listed.
  - **Notes:**

- [ ] **Step 2.** Select the **Fill** button at the right of the row's **Name** cell.
  - **Expected:**
    - The details panel is headed **Backend engineer 2**.
    - Under **Fill this planned hire**, **New person** is selected.
    - The fields are **Name**, **ID**, **Position**, **Start** and **Manager**.
    - **Position** reads **Software Engineer**.
  - **Notes:**

- [ ] **Step 3.** Type `Fictional new starter` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 4.** Type `EMP-9001` in **ID**.
  - **Expected:** **ID** shows what was typed.
  - **Notes:**

- [ ] **Step 5.** Select **Fill** at the foot of the panel.
  - **Expected:**
    - The panel is headed with a hollow yellow dot before **Fictional new starter**.
    - The **Backend engineer 2** row has no **Fill** button.
    - The **Backend engineer 2** row has a hollow yellow dot in its slot.
  - **Notes:**

- [ ] **Step 6.** Select the details button of the **Backend engineer 2** row.
  - **Expected:**
    - The panel is headed **Backend engineer 2**.
    - A **Filled by** section reads **Fictional new starter** in **Name**.
    - The **Filled by** section reads **EMP-9001** in **ID**.
  - **Notes:**

- [ ] **Step 7.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 8.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 9.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 10.** Type `Backend engineer 2` in the search box.
  - **Expected:** An entry naming **Backend engineer 2** is listed, with a checkbox.
  - **Notes:**

- [ ] **Step 11.** Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 12.** Select **Approve 1 draft**.
  - **Expected:** The dialog reads **Also approves the drafts these depend on:** and names **Fictional new starter**.
  - **Notes:**

- [ ] **Step 13.** Select **Approve** in the dialog.
  - **Expected:** A notice says the drafts were approved.
  - **Notes:**

- [ ] **Step 14.** Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] **Step 15.** Search for `Fictional new starter`.
  - **Expected:**
    - One row is shown, with no dot.
    - It reads **Software Engineer** in **Position**.
    - Its **Manager** holds a name.
  - **Notes:**

- [ ] **Step 16.** Search for `Backend engineer 2`.
  - **Expected:** No row named **Backend engineer 2** is shown.
  - **Notes:**

#### ACC-04: Filling a Planned Manager Moves the Planned Hires Under It

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-03.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] **Step 1.** Search for `Engineering Manager TBD`.
  - **Expected:** A row for **Engineering Manager TBD** is listed.
  - **Notes:**

- [ ] **Step 2.** Select the row's **State** cell, press Enter, choose **Approved to hire**, and press Enter.
  - **Expected:** A **Fill** button shows in the row's **Name** cell.
  - **Notes:**

- [ ] **Step 3.** Select **Fill**.
  - **Expected:** A **Direct reports** row names the planned hires that report to this one, **Platform engineer** among them.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional new lead` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 5.** Type `EMP-9002` in **ID**.
  - **Expected:** **ID** shows what was typed.
  - **Notes:**

- [ ] **Step 6.** Select the change button beside **Grade**, and choose **P1**.
  - **Expected:** **Grade** reads **P1**.
  - **Notes:**

- [ ] **Step 7.** Select **Fill** at the foot of the panel.
  - **Expected:**
    - The form closes.
    - The panel is headed **Fictional new lead**.
  - **Notes:**

- [ ] **Step 8.** Search for `Platform engineer TBD`.
  - **Expected:** The **Manager** cell of **Platform engineer** reads **Fictional new lead**, with a hollow yellow dot before it.
  - **Notes:**

- [ ] **Step 9.** Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 10.** Search for `Platform engineer TBD` again.
  - **Expected:**
    - The **Manager** cell of **Platform engineer** reads **Engineering Manager, TBD-** and a number.
    - The row has no dot.
  - **Notes:**

#### ACC-05: A New Manager Moves Someone to Their Team

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ACC-04. Step 7 signs in as another account.

**Preconditions:** **People** page open, with no filters.

- [ ] **Step 1.** Search for `Samuel Richter`.
  - **Expected:**
    - The **Manager** cell of **Samuel Richter** reads **Atmananda Ganaka**.
    - His **Team** cell reads **Payments team**.
  - **Notes:**

- [ ] **Step 2.** Select the row's **Manager** cell, press Enter, type `Max`, and choose **Max Munk**.
  - **Expected:**
    - The **Manager** cell reads **Max Munk**, with a hollow yellow dot before it.
    - The **Team** cell reads **Mobile team**.
    - The **Manager assigned** cell holds today's date.
    - The row is faintly yellow.
  - **Notes:**

- [ ] **Step 3.** Select the row's details button, and read the **Reporting** section.
  - **Expected:**
    - **Manager** reads **Max Munk**, with a hollow yellow dot before it.
    - Under it, **Atmananda Ganaka** in grey, with a green dot before it.
  - **Notes:**

- [ ] **Step 4.** Choose **Dark** in the Appearance menu, and read the panel and the row.
  - **Expected:**
    - In dark mode, every value, dot and change button in the panel is easy to read.
    - In dark mode, the faintly yellow row is easy to read.
  - **Notes:**

- [ ] **Step 5.** Choose **Light** in the Appearance menu.
  - **Expected:** The page is light.
  - **Notes:**

- [ ] **Step 6.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 7.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 8.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 9.** Type `Samuel Richter` in the search box.
  - **Expected:** An entry naming **Samuel Richter** is listed, with a checkbox.
  - **Notes:**

- [ ] **Step 10.** Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 11.** Select **Approve 1 draft**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 12.** Select **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 13.** Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] **Step 14.** Search for `Samuel Richter`.
  - **Expected:**
    - The row has no dot.
    - It reads **Max Munk** in **Manager**.
    - It reads **Mobile team** in **Team**.
  - **Notes:**

#### ACC-06: A Number Column Is Added, Approved and Filled In

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-05. Step 6 signs in as another account, and step 12 signs in with this account again.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] **Step 1.** Select **New column**.
  - **Expected:** The **New column** dialog opens.
  - **Notes:**

- [ ] **Step 2.** Choose **Number** in **Type**.
  - **Expected:**
    - **List** and **Several choices** are gone.
    - **Class** is shown, with **General** chosen.
  - **Notes:**

- [ ] **Step 3.** Type `On-call weeks` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 4.** Leave **General** chosen, and select **Add column**.
  - **Expected:**
    - The dialog closes.
    - An **On-call weeks** column with empty cells is at the right end of the table.
    - A hollow yellow dot is before its name.
  - **Notes:**

- [ ] **Step 5.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 6.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] **Step 7.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 8.** Type `On-call` in the search box.
  - **Expected:**
    - One entry is shown, for the column **On-call weeks**.
    - The entry has a checkbox.
  - **Notes:**

- [ ] **Step 9.** Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 10.** Select **Approve 1 draft**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 11.** Select **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 12.** Sign out, and sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Operations Manager**.
  - **Notes:**

- [ ] **Step 13.** Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] **Step 14.** Search for `Max Munk`.
  - **Expected:** A row for **Max Munk** is listed.
  - **Notes:**

- [ ] **Step 15.** Select the **On-call weeks** cell of the **Max Munk** row, type `4`, and press Enter.
  - **Expected:** The cell reads **4**, with a hollow yellow dot before it.
  - **Notes:**

- [ ] **Step 16.** Search for `Lilian Lang`.
  - **Expected:** A row for **Lilian Lang** is listed.
  - **Notes:**

- [ ] **Step 17.** Select the **On-call weeks** cell of the **Lilian Lang** row, type `2.5`, and press Enter.
  - **Expected:**
    - **On-call weeks** has no dot before its name.
    - The cell reads **2.5**, with a hollow yellow dot before it.
  - **Notes:**

- [ ] **Step 18.** Select the **×** at the right end of the search box.
  - **Expected:** The search box is empty.
  - **Notes:**

- [ ] **Step 19.** Select the **On-call weeks** header, then **Highest first**.
  - **Expected:**
    - Max Munk's row comes before Lilian Lang's.
    - Both come before the rows with no number.
  - **Notes:**

#### ACC-07: Metrics Count People by Two Columns and Follow a Filter

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ACC-06.

**Preconditions:** **People** page open, with no filters and no search.

- [ ] **Step 1.** Select **Metrics** above the table.
  - **Expected:**
    - The Metrics panel opens on the right.
    - The table narrows beside it.
  - **Notes:**

- [ ] **Step 2.** Set **Break down by** to **Position**.
  - **Expected:** **Break down by** reads **Position**.
  - **Notes:**

- [ ] **Step 3.** Set **and by** to **Site**.
  - **Expected:**
    - A table headed **Position by Site** has a column for each site, an **Empty** column for the planned hires, which have no site, and an **All** column.
    - The **Position by Site** table has a row for each position and an **All** row.
  - **Notes:**

- [ ] **Step 4.** Open the **Site** column menu, and select **Filter…**.
  - **Expected:**
    - The filter opens.
    - It lists the sites.
  - **Notes:**

- [ ] **Step 5.** Pick only **Ashgrove**.
  - **Expected:** **Ashgrove** is the only site picked.
  - **Notes:**

- [ ] **Step 6.** Press Esc.
  - **Expected:**
    - The bar above the table says how many rows are shown of how many, such as **47 of 158**.
    - The count line under the panel's title gives the first number in the bar, such as **47 people**.
    - The **Position by Site** table has only the **Ashgrove** column besides **All**.
  - **Notes:**

- [ ] **Step 7.** Select **Clear all** in the bar above the table.
  - **Expected:**
    - The filter is cleared.
    - The panel stays open.
  - **Notes:**

#### ACC-08: Metrics Show Live Figures Beside Drafts

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ACC-07.

**Preconditions:** **People** page open, with the Metrics panel open.

- [ ] **Step 1.** Open the Draft menu, and select **Drafts beside live**.
  - **Expected:**
    - The Draft menu stays open.
    - A tick is before **Drafts beside live**.
  - **Notes:**

- [ ] **Step 2.** Press Esc.
  - **Expected:** The Draft menu closes.
  - **Notes:**

- [ ] **Step 3.** Set **Break down by** to **Grade**.
  - **Expected:** **Break down by** reads **Grade**.
  - **Notes:**

- [ ] **Step 4.** Set **and by** to **Nothing more**.
  - **Expected:**
    - At least one row, such as **P1**, shows a count with a dimmed live figure under it, with a green dot before the live figure.
    - Rows whose count the drafts do not change show no live figure.
  - **Notes:**

- [ ] **Step 5.** Press Esc.
  - **Expected:**
    - The panel closes.
    - The **Metrics** button has the keyboard focus.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### Journey 2: Saved Views

#### ACC-09: A Personal View Keeps Frozen Columns, Widths and Column Order

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ACC-08.

**Preconditions:** Restore the Seed Data run after ACC-08. Signed in with this account. **Light** chosen in the Appearance menu. **People** page open, with no view applied.

- [ ] **Step 1.** Open the **ID** column menu, and select **Freeze up to this column**.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 2.** Scroll the table sideways to the right.
  - **Expected:**
    - **Name** and **ID** stay in place.
    - A thin grey line and a soft shadow are at the right of **ID**.
    - The other columns pass under them.
  - **Notes:**

- [ ] **Step 3.** Scroll back to the left.
  - **Expected:** The table is back at its left end.
  - **Notes:**

- [ ] **Step 4.** Drag the right edge of the **Name** column's name to the right by about the width of the column.
  - **Expected:**
    - A short blue line shows on the edge.
    - **Name** widens with the pointer.
  - **Notes:**

- [ ] **Step 5.** Select **Position** in the header, then **Move right**.
  - **Expected:**
    - **Position** moves one place to the right.
    - No dot shows before its name.
    - No Publish button is in the top bar.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu, and select **Save view…**.
  - **Expected:**
    - A dialog titled **Save view** shows **Name**.
    - Under **Includes**, it shows **Frozen** up to **ID**, **Column order** **Moved**, and **Widths** **Name**.
    - It offers no choice about sharing.
  - **Notes:**

- [ ] **Step 7.** Type `Fictional layout` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 8.** Select **Save view**.
  - **Expected:**
    - The dialog closes.
    - The Views button reads **Fictional layout**.
  - **Notes:**

- [ ] **Step 9.** Open the Views menu, and select **Clear view**.
  - **Expected:**
    - Only **Name** stays in place when the table scrolls sideways.
    - **Position** is in its original place.
    - **Name** is at its original width.
  - **Notes:**

- [ ] **Step 10.** Open the Views menu, and select **Fictional layout** under **My views**.
  - **Expected:**
    - **Name** and **ID** are frozen.
    - **Name** is about twice its original width.
    - **Position** is one place to the right of its original place.
  - **Notes:**

- [ ] **Step 11.** Open the Views menu, and select **Delete view**.
  - **Expected:**
    - A notice reads **Deleted the Fictional layout view.**
    - The notice offers **Undo**.
  - **Notes:**

#### ACC-10: A Shared View Is Seen by Others Until It Is Taken Back

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, in the main browser, changed from ACC-09. The second browser signs in as another account in step 7.

**Preconditions:** Signed in with this account in the main browser. **People** page open, with no view applied.

- [ ] **Step 1.** Search for `el`.
  - **Expected:** Each row listed has **el** in one of its cells, in capitals or not.
  - **Notes:**

- [ ] **Step 2.** Open the Views menu, and select **Save view…**.
  - **Expected:** The dialog shows a checkbox, **Share with everyone who sees this table**, not ticked, below **Name**.
  - **Notes:**

- [ ] **Step 3.** Type `Fictional hiring` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 4.** Tick **Share with everyone who sees this table**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 5.** Select **Save view**.
  - **Expected:**
    - The dialog closes.
    - The Views button reads **Fictional hiring**.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu.
  - **Expected:**
    - The heading **Shared views** is above **Fictional hiring**.
    - **Take back current view** is offered.
  - **Notes:**

- [ ] **Step 7.** In the second browser, sign in as the Engineering Manager, `engineering.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Manager**.
  - **Notes:**

- [ ] **Step 8.** In the second browser, select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] **Step 9.** In the second browser, open the Views menu.
  - **Expected:** **Shared views** lists **Fictional hiring**.
  - **Notes:**

- [ ] **Step 10.** In the second browser, select **Fictional hiring**.
  - **Expected:** The search box shows **el**.
  - **Notes:**

- [ ] **Step 11.** In the second browser, open the Views menu again.
  - **Expected:** **Rename…**, **Delete view** and **Take back current view** are not offered.
  - **Notes:**

- [ ] **Step 12.** In the main browser, press Esc.
  - **Expected:** The Views menu closes.
  - **Notes:**

- [ ] **Step 13.** In the main browser, open the Views menu, and select **Take back current view**.
  - **Expected:**
    - A notice says **Took back the Fictional hiring view.**
    - The notice offers **Undo**.
    - In the Views menu, **Fictional hiring** is under **My views**.
  - **Notes:**

- [ ] **Step 14.** In the second browser, reload the page.
  - **Expected:** The **People** page opens again.
  - **Notes:**

- [ ] **Step 15.** In the second browser, open the Views menu.
  - **Expected:** **Fictional hiring** is not listed.
  - **Notes:**

- [ ] **Step 16.** In the main browser, open the Views menu, and select **Fictional hiring**.
  - **Expected:** The Views button reads **Fictional hiring**.
  - **Notes:**

- [ ] **Step 17.** Open the Views menu, and select **Delete view**.
  - **Expected:** **Fictional hiring** is gone from the Views menu.
  - **Notes:**

### Journey 3: Org Chart and Feature Teams

#### ACC-11: A Team Member Reads the Org Chart

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-10.

**Preconditions:** Signed in with this account, in the main browser. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart shows each person's name, position, and the team they lead.
  - **Notes:**

- [ ] **Step 2.** Select the name on the card for **Lorenza Thiel**.
  - **Expected:**
    - The details panel slides out on the right, headed **Lorenza Thiel**.
    - The panel shows no pencils.
  - **Notes:**

- [ ] **Step 3.** Select the **Show only this team** button at the top right of the card for **Lorenza Thiel**.
  - **Expected:**
    - **Lorenza Thiel** is at the top of the chart.
    - Her reports are under her.
    - To the right of the heading, the page reads **Only the team of Lorenza Thiel is shown.**
    - **Show everyone** is beside it.
  - **Notes:**

- [ ] **Step 4.** Select **Show everyone**.
  - **Expected:**
    - **Silje Holm-Schrøder** is at the top of the chart.
    - The line **Only the team of Lorenza Thiel is shown.** is gone.
  - **Notes:**

- [ ] **Step 5.** In the finder, type `Gloria`, and select **Gloria Armas Guardado**.
  - **Expected:**
    - The chart moves until the card for **Gloria Armas Guardado** is in the middle of the panel.
    - A blue ring is around the card.
  - **Notes:**

- [ ] **Step 6.** Choose **Feature teams** in the teams switch.
  - **Expected:**
    - The chart shows four feature teams side by side, each first card naming its team:
      - **Mobile apps**
      - **Payments core**
      - **Search and discovery**, with a yellow dot before it
      - **Platform reliability**, with a grey lock before it
    - Above the chart, a line in grey reads **Other dates need Personal access.**
    - There is no date control.
  - **Notes:**

- [ ] **Step 7.** Choose **Reporting teams** in the teams switch.
  - **Expected:**
    - The chart shows managers' teams.
    - Above the chart, a line in grey reads **Other dates need Personal access.**
    - There is no date control.
  - **Notes:**

#### ACC-12: An Engineering Manager Reads a Note Beside the Chart

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ACC-11.

**Preconditions:** Signed in with this account. **Light** chosen in the Appearance menu. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** On the card at the top of the chart, select the name **Silje Holm-Schrøder**.
  - **Expected:**
    - The details panel slides out on the right, headed **Silje Holm-Schrøder**.
    - The link **Show in People** is under her position.
    - The chart narrows.
    - Her card, with a blue ring, stays in the middle of the space left.
  - **Notes:**

- [ ] **Step 2.** Select **Tanushree Patel-Singh** under **Direct reports**, and read **Onboarding** under **Columns**.
  - **Expected:**
    - The panel shows **Tanushree Patel-Singh**.
    - **Onboarding** shows the heading **First weeks**.
    - Under the heading is a checklist of four steps, with only **Laptop and accounts ready** ticked.
    - In the checklist, the buddy's name **Elly Gunther** is in bold.
    - Under the checklist, **On track** is in teal.
    - The last line ends with the link **onboarding guide**.
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu, and read the panel.
  - **Expected:** In dark mode, every label, value, link and checkbox in the panel is easy to read.
  - **Notes:**

- [ ] **Step 4.** Choose **Light** in the Appearance menu.
  - **Expected:** The page is light.
  - **Notes:**

- [ ] **Step 5.** Select the **×** at the top right of the panel.
  - **Expected:** The panel slides away.
  - **Notes:**

#### ACC-13: A Person Drafted to Another Manager Is Drawn in Both Places

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ACC-12.

**Preconditions:** **Org chart** page open, showing the top two levels. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Read the card for **Simone Jean**, under **Silje Holm-Schrøder**.
  - **Expected:**
    - The card is faintly yellow.
    - A yellow dot is before her name.
  - **Notes:**

- [ ] **Step 2.** On the card for **Viktoria Holmberg**, select **Show 3 reports**.
  - **Expected:**
    - **Simone Jean**, **우아현** and **西尾 亮** appear in a column under her.
    - The card for **Simone Jean** there is faded and light green, with a dashed edge.
    - Its name is in grey, with a green dot before it.
    - The line to it is dashed.
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu.
  - **Expected:**
    - In dark mode, the faintly yellow card and the light green card are easy to tell apart from the other cards.
    - In dark mode, every word on them is easy to read.
  - **Notes:**

- [ ] **Step 4.** Choose **Light** in the Appearance menu.
  - **Expected:**
    - In light mode, the faintly yellow card and the light green card are easy to tell apart from the other cards.
    - In light mode, every word on them is easy to read.
  - **Notes:**

#### ACC-14: A Feature Lead Proposes a Lead and a Member

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, changed from ACC-13. Step 2 signs in as another account in the second browser.

**Preconditions:** Signed in with this account, acting as **Feature Lead**. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch.

- [ ] **Step 1.** Select the Feature teams button, then **Platform reliability**.
  - **Expected:**
    - The team panel opens, titled **Platform reliability**, with a grey lock before it.
    - Pointing at the lock shows **Being changed by Second Engineering Operations Manager**.
    - No row has a change button.
  - **Notes:**

- [ ] **Step 2.** In the second browser, sign in as the Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`.
  - **Expected:** The top bar shows the Publish button.
  - **Notes:**

- [ ] **Step 3.** In the second browser, run Discard the Unpublished Changes.
  - **Expected:**
    - A notice says **Discarded** followed by the number of changes.
    - The Publish button is gone.
  - **Notes:**

- [ ] **Step 4.** In the main browser, reload the page.
  - **Expected:**
    - The team panel is titled **Platform reliability**, with no lock.
    - **Feature lead** reads **None**.
    - **Name**, **Feature lead** and **Members** each have a change button.
  - **Notes:**

- [ ] **Step 5.** Select the change button in the **Feature lead** row, type `Polly`, and press Enter.
  - **Expected:**
    - **Feature lead** reads **Polly Smith**, with a hollow yellow dot before it.
    - On the chart, the card reading **Platform reliability** and **No feature lead** is gone.
    - Polly Smith's card is at the top of the team in its place.
    - **Platform reliability** is under her position.
    - The team's members are under her.
  - **Notes:**

- [ ] **Step 6.** Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] **Step 7.** Type `Rosendo`, and press Enter.
  - **Expected:** **Rosendo Champlin** has a tick.
  - **Notes:**

- [ ] **Step 8.** Press Enter.
  - **Expected:**
    - **Members** lists **Rosendo Champlin**, with a hollow yellow dot before his name.
    - On the chart, a card for him is under Polly Smith, with a hollow yellow dot before his name.
    - His card in **Mobile apps** is still there.
  - **Notes:**

- [ ] **Step 9.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

#### ACC-15: A Project Manager Approves the Feature Team

**Account:** Project Manager, `project.manager@fathom.test`, changed from ACC-14.

**Preconditions:** ACC-14 done. Signed in with this account.

- [ ] **Step 1.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 2.** Type `Platform reliability` in the search box.
  - **Expected:**
    - One entry is shown, **the feature team Platform reliability**.
    - A line sets **Feature lead** to **Polly Smith**.
    - A line for **Members** adds **Rosendo Champlin**.
    - It was made by **Feature Lead**.
  - **Notes:**

- [ ] **Step 3.** Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 4.** Select **Approve 1 draft**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 5.** Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice begins **Approved**.
  - **Notes:**

- [ ] **Step 6.** Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] **Step 7.** Choose **Feature teams** in the teams switch.
  - **Expected:**
    - **Platform reliability** is led by **Polly Smith**.
    - **Rosendo Champlin** is among the cards under her.
    - There are no dots.
  - **Notes:**

#### ACC-16: A Member Joins a Feature Team From an Earlier Date

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-15. Step 8 signs in as another account.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] **Step 1.** Select the left arrow once.
  - **Expected:**
    - The **Date** box shows the first day of last month.
    - Below the row, text reads **Showing** with that day, then **Changes take effect from this date.**
  - **Notes:**

- [ ] **Step 2.** Select the Feature teams button, then **Search and discovery**.
  - **Expected:**
    - The team panel is titled **Search and discovery**.
    - **Name** reads **Search and discovery**, with a yellow dot before it.
    - Under it, **Search**, with a green dot before it.
  - **Notes:**

- [ ] **Step 3.** Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] **Step 4.** Type `Branson`, and press Enter.
  - **Expected:** **Branson O'Keefe** has a tick.
  - **Notes:**

- [ ] **Step 5.** Press Enter.
  - **Expected:**
    - **Members** lists **Branson O'Keefe**, with a hollow yellow dot before his name.
    - No date is after his name.
  - **Notes:**

- [ ] **Step 6.** Select **Today**.
  - **Expected:**
    - The text below the row is gone.
    - In the team panel, **Branson O'Keefe** has a hollow yellow dot before his name, followed in grey by **from** and the first day of last month.
  - **Notes:**

- [ ] **Step 7.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 8.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 9.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 10.** Type `Branson` in the search box.
  - **Expected:**
    - One entry is listed, **the feature team Search and discovery**.
    - Its **Members** line adds **Branson O'Keefe**.
    - Its **Joining and leaving dates** line gives **Branson O'Keefe** and the first day of last month.
  - **Notes:**

- [ ] **Step 11.** Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 12.** Select **Approve 1 draft**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 13.** Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice begins **Approved**.
  - **Notes:**

#### ACC-17: Feature Assignments Show the Earlier Join

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-16.

**Preconditions:** ACC-16 done. Signed in with this account. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select the **Feature assignments** page in the left-hand menu.
  - **Expected:**
    - The page is headed **Feature assignments**.
    - **Group by: Manager** is above the table.
    - The table has a **Person** column on the left.
    - The table has a column for each month, starting with the current month.
  - **Notes:**

- [ ] **Step 2.** Select **Feature team** in the Group by menu.
  - **Expected:**
    - The rows are grouped under the feature teams in order of name, then **No feature team**.
    - Each label names a feature team, in a box tinted with the team's colour, or grey for a team with none.
  - **Notes:**

- [ ] **Step 3.** Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens.
  - **Notes:**

- [ ] **Step 4.** Type `Branson`.
  - **Expected:**
    - Only **Branson O'Keefe** is listed, under the **Search and discovery** group.
    - His current month's cell holds a **Search and discovery** label.
  - **Notes:**

- [ ] **Step 5.** Press Esc.
  - **Expected:** The filter closes.
  - **Notes:**

- [ ] **Step 6.** Scroll the table one month to the left.
  - **Expected:**
    - The **Person** column stays in place.
    - Last month's cell for **Branson O'Keefe** holds a **Search and discovery** label too.
    - The month before it holds no label.
  - **Notes:**

- [ ] **Step 7.** Choose **Dark** in the Appearance menu.
  - **Expected:** In dark mode, the labels, headings and group names are easy to read.
  - **Notes:**

- [ ] **Step 8.** Choose **Light** in the Appearance menu.
  - **Expected:** In light mode, the labels, headings and group names are easy to read.
  - **Notes:**

#### ACC-18: Allocations Show Each Month's Features and Their Totals

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ACC-17.

**Preconditions:** **Light** chosen in the Appearance menu. **Feature assignments** open, with **Teams** chosen in the mode switch, **Feature team** chosen in the Group by menu, and nothing in the search box. The **Person** filter from ACC-17 removed with **Clear all** in the bar above the table.

- [ ] **Step 1.** Select **Allocations** in the mode switch.
  - **Expected:**
    - The table opens at the current month.
    - It is grouped by **Feature team**.
    - Cells list features, each on a line of its own with its percentage at the right, such as **50%**.
  - **Notes:**

- [ ] **Step 2.** In the current month's column, find a cell that lists two features.
  - **Expected:**
    - Under the two features, a last line gives the two percentages added up, at the right.
    - A thin line above it sets it off.
  - **Notes:**

- [ ] **Step 3.** In the current month's column, find a cell whose last line reads **Over**, and one whose last line reads **Under**.
  - **Expected:**
    - **Over** and its percentage are red and bold.
    - **Under** and its percentage are grey.
  - **Notes:**

- [ ] **Step 4.** Choose **Dark** in the Appearance menu.
  - **Expected:** In dark mode the feature names, the percentages, and the **Over** and **Under** lines are easy to read and to tell apart.
  - **Notes:**

- [ ] **Step 5.** Choose **Light** in the Appearance menu.
  - **Expected:** In light mode the feature names, the percentages, and the **Over** and **Under** lines are easy to read and to tell apart.
  - **Notes:**

- [ ] **Step 6.** Select **Teams** in the mode switch.
  - **Expected:**
    - The cells show feature teams as labels.
    - The table is grouped by **Feature team**.
  - **Notes:**

#### ACC-19: The Feature Lead, Acting as Engineering Manager, Plans a Team Change in Feature Assignments

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-18.

**Preconditions:** ACC-16 done. Signed in with this account, acting as **Engineering Manager**. **Light** chosen in the Appearance menu. Select the **Feature assignments** page in the left-hand menu, with **Teams** chosen in the mode switch, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Type `Branson` in the search box.
  - **Expected:**
    - Only **Branson O'Keefe**'s row is listed.
    - His current month's cell holds a **Search and discovery** label.
  - **Notes:**

- [ ] **Step 2.** Select his cell two months after the current month, and press Enter.
  - **Expected:** The team list opens, with **Search and discovery** shown as chosen.
  - **Notes:**

- [ ] **Step 3.** Type `Payments`, and press Tab.
  - **Expected:**
    - The team list closes.
    - From the cell selected on, each cell holds a **Payments core** label with a hollow yellow dot before it, beside the **Search and discovery** label.
    - The cells before the one selected hold only the **Search and discovery** label, with no dot.
    - The row is faintly yellow.
    - A light green Live row is under it.
  - **Notes:**

- [ ] **Step 4.** Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] **Step 5.** Choose **Feature teams** in the teams switch.
  - **Expected:** The chart shows the feature teams side by side.
  - **Notes:**

- [ ] **Step 6.** Select the Feature teams button, then **Payments core**.
  - **Expected:**
    - The team panel is titled **Payments core**.
    - **Branson O'Keefe** is in the **Members** row, with a hollow yellow dot before his name.
    - His name is followed in grey by **from** and the first day of the month two months after the current one.
  - **Notes:**

#### ACC-20: A Team Member Is Told Why Feature Assignments Is Missing

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-19.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select the **Feature assignments** page in the left-hand menu.
  - **Expected:**
    - Under the **Feature assignments** heading, a line in grey reads **Feature assignments needs Personal access.**
    - There is no table.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### Journey 4: The Plan

#### ACC-21: A Product Manager Adds a Customer, a Proposal and a Project With Milestones

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-20.

**Preconditions:** Restore the Seed Data run after ACC-20. Signed in with this account. **Projects** page open from the left-hand menu.

- [ ] **Step 1.** Select the **Customers** tab.
  - **Expected:** The **Customers** tab is selected.
  - **Notes:**

- [ ] **Step 2.** Select **New customer**.
  - **Expected:** The side panel opens, headed **New customer**.
  - **Notes:**

- [ ] **Step 3.** Type `Fictional Ferry Co-op` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 4.** Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before **Fictional Ferry Co-op**.
    - The table has a row for it, with a hollow yellow dot in its slot.
  - **Notes:**

- [ ] **Step 5.** Select the **Proposals** tab.
  - **Expected:** The **Proposals** tab is selected.
  - **Notes:**

- [ ] **Step 6.** Select **New proposal**.
  - **Expected:** The side panel opens, headed **New proposal**.
  - **Notes:**

- [ ] **Step 7.** Type `Fictional Ferry Proposal` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 8.** Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before **Fictional Ferry Proposal**.
    - **Status** reads **Open**.
  - **Notes:**

- [ ] **Step 9.** Select the **Projects** tab.
  - **Expected:** The **Projects** tab is selected.
  - **Notes:**

- [ ] **Step 10.** Select **New project**.
  - **Expected:** The side panel opens, headed **New project**.
  - **Notes:**

- [ ] **Step 11.** Type `Fictional Harbour Lights` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 12.** Type `FHL-1` in **Project ID**.
  - **Expected:** **Project ID** shows what was typed.
  - **Notes:**

- [ ] **Step 13.** Select the pencil button in the **Owner** row, and pick any person. Write the owner's name in the notes.
  - **Expected:** **Owner** shows the name picked.
  - **Notes:**

- [ ] **Step 14.** Select the pencil button in the **Customers** row, and pick **Fictional Ferry Co-op**.
  - **Expected:** **Customers** shows **Fictional Ferry Co-op**.
  - **Notes:**

- [ ] **Step 15.** Select the pencil button in the **Proposals** row, and pick **Fictional Ferry Proposal**.
  - **Expected:** **Proposals** shows **Fictional Ferry Proposal**.
  - **Notes:**

- [ ] **Step 16.** Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before **Fictional Harbour Lights**.
    - **First milestone**, **Last milestone** and **Next delivery** read **None**.
    - Under **Milestones**, **No milestones yet** and an **Add milestone** button.
  - **Notes:**

- [ ] **Step 17.** Select **Add milestone**.
  - **Expected:** A dialog titled **New milestone** opens.
  - **Notes:**

- [ ] **Step 18.** Type `Pilot` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 19.** Type `20300315` in **Date**.
  - **Expected:** **Date** shows the date typed.
  - **Notes:**

- [ ] **Step 20.** Tick **Customer delivery**.
  - **Expected:** **Customer delivery** is ticked.
  - **Notes:**

- [ ] **Step 21.** Select **Add milestone** in the dialog.
  - **Expected:**
    - Under **Milestones**, a hollow yellow dot before **Pilot**.
    - Under **Pilot**, the date for 2030-03-15 and **, customer delivery**.
  - **Notes:**

- [ ] **Step 22.** Select **Add milestone**.
  - **Expected:** A dialog titled **New milestone** opens.
  - **Notes:**

- [ ] **Step 23.** Type `Go live` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 24.** Type `20300630` in **Date**.
  - **Expected:** **Date** shows the date typed.
  - **Notes:**

- [ ] **Step 25.** Leave **Customer delivery** unticked, and select **Add milestone** in the dialog.
  - **Expected:**
    - **Go live** is listed after **Pilot**.
    - **First milestone** shows 2030-03-15.
    - **Last milestone** shows 2030-06-30.
    - **Next delivery** shows 2030-03-15.
    - The table's row for **Fictional Harbour Lights** shows 2030-03-15 as **First milestone**, 2030-06-30 as **Last milestone** and 2030-03-15 as **Next delivery**.
  - **Notes:**

- [ ] **Step 26.** Run Publish.
  - **Expected:** The dots before the project and both milestones are now filled yellow.
  - **Notes:**

#### ACC-22: A Project Manager Approves the Project and Its Milestones

**Account:** Project Manager, `project.manager@fathom.test`, changed from ACC-21.

**Preconditions:** ACC-21 done. Signed in with this account. **Projects** page open, on the **Projects** tab.

- [ ] **Step 1.** Open the ⋯ menu of **Fictional Harbour Lights**, and select **Approve draft**.
  - **Expected:**
    - A dialog asks to approve the drafts.
    - Under **Also approves the drafts these depend on:**, it lists **the proposal Fictional Ferry Proposal** and **the customer Fictional Ferry Co-op**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve** in the dialog.
  - **Expected:** **Fictional Harbour Lights** has no dot.
  - **Notes:**

- [ ] **Step 3.** Select the **Milestones** tab.
  - **Expected:**
    - The **Milestones** tab is selected.
    - The table of milestones is under the tab.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional Harbour Lights` in the search box.
  - **Expected:** **Pilot** and **Go live** are listed, each with a yellow dot in its slot.
  - **Notes:**

- [ ] **Step 5.** Open the Draft menu.
  - **Expected:** The menu offers **Approve 2 drafts…**.
  - **Notes:**

- [ ] **Step 6.** Select **Approve 2 drafts…**.
  - **Expected:** A dialog titled **Approve 2 drafts?** opens.
  - **Notes:**

- [ ] **Step 7.** Select **Approve** in the dialog.
  - **Expected:**
    - **Pilot** and **Go live** have no dots.
    - Each has **Fictional Harbour Lights** under **Project**, with **FHL-1** in grey before it.
  - **Notes:**

- [ ] **Step 8.** Choose **Dark** in the Appearance menu, and look over the tabs and the table.
  - **Expected:** In dark mode, the text, the tabs and the ticked **Customer delivery** box are easy to read.
  - **Notes:**

- [ ] **Step 9.** Choose **Light** in the Appearance menu.
  - **Expected:** The page is light.
  - **Notes:**

#### ACC-23: A Product Manager Adds a Feature With a Formatted Note

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-22. Step 11 signs in as another account.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

- [ ] **Step 1.** Select **New feature**.
  - **Expected:**
    - The **New feature** panel opens beside the table.
    - Labels are at the left of each row, under the headings **Details** and **Columns**.
    - The **Notes** row reads **None**.
    - A pencil button is at the right of the **Notes** row.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional Atlas` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 3.** Select the pencil button in the **Notes** row.
  - **Expected:**
    - A second panel opens under **New feature**, titled **Notes for New feature**.
    - **Note**, **Editor** and **Markdown** are at its top.
    - **Editor** is chosen.
    - A toolbar is under the text.
  - **Notes:**

- [ ] **Step 4.** Type `Ferry routes first`.
  - **Expected:** The note shows what was typed.
  - **Notes:**

- [ ] **Step 5.** Select those words.
  - **Expected:** The words are highlighted.
  - **Notes:**

- [ ] **Step 6.** Select **Bold** in the toolbar.
  - **Expected:** The words are in bold.
  - **Notes:**

- [ ] **Step 7.** Select **Save** in the note's panel.
  - **Expected:**
    - The note's panel closes.
    - The **Notes** row shows **Ferry routes first** in bold.
    - **Name** still reads **Fictional Atlas**.
  - **Notes:**

- [ ] **Step 8.** Select **Add** at the foot of the **New feature** panel.
  - **Expected:**
    - The feature's details show beside the table, headed with a hollow yellow dot before **Fictional Atlas**.
    - **Ferry routes first** is in bold under **Notes**.
  - **Notes:**

- [ ] **Step 9.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 10.** Reload the page.
  - **Expected:**
    - **Fictional Atlas** is under the heading **Later**.
    - Its row has a filled yellow dot in its slot.
  - **Notes:**

- [ ] **Step 11.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] **Step 12.** Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] **Step 13.** Open the ⋯ menu of **Fictional Atlas**, and select **Approve draft**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 14.** Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads **Approved 1 draft.**
    - **Fictional Atlas** has no dot.
  - **Notes:**

#### ACC-24: Leaving the New Feature Panel Asks First

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-23.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select **New feature**.
  - **Expected:** The **New feature** panel opens beside the table.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional Compass` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 3.** Select **Cancel** at the foot of the panel.
  - **Expected:**
    - A box asks **Discard the new feature?**
    - The box offers **Keep adding** and **Discard**.
  - **Notes:**

- [ ] **Step 4.** Select **Keep adding**.
  - **Expected:**
    - The box closes.
    - **Name** still reads **Fictional Compass**.
  - **Notes:**

- [ ] **Step 5.** Select **Cancel**.
  - **Expected:** A box asks **Discard the new feature?**
  - **Notes:**

- [ ] **Step 6.** Select **Discard**.
  - **Expected:**
    - The panel closes.
    - No row for **Fictional Compass** is in the table.
    - No Publish button is in the top bar.
  - **Notes:**

#### ACC-25: A Feature Linked From Features Is Found From Its Project

**Account:** Product Manager, `product.manager@fathom.test`, the same as ACC-24. Step 5 signs in as another account.

**Preconditions:** ACC-22 and ACC-23 done. **Features** page open.

- [ ] **Step 1.** Select the **Projects** cell of **Fictional Atlas**, and press Enter.
  - **Expected:**
    - A list of projects opens, with a search box.
    - Each project is named by its ID, where it has one, then its name, such as **FHL-1 Fictional Harbour Lights**.
  - **Notes:**

- [ ] **Step 2.** Pick **FHL-1 Fictional Harbour Lights**, and press Enter.
  - **Expected:** The **Projects** cell names **Fictional Harbour Lights**, with **FHL-1** in grey before it.
  - **Notes:**

- [ ] **Step 3.** Select the **Proposals** cell of **Fictional Atlas**, press Enter, pick **Fictional Ferry Proposal**, and press Enter.
  - **Expected:**
    - The **Proposals** cell names **Fictional Ferry Proposal**.
    - **Fictional Atlas** has no dot.
  - **Notes:**

- [ ] **Step 4.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 5.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] **Step 6.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 7.** Type `Fictional` in the search box.
  - **Expected:**
    - Two entries are shown, one for the project **Fictional Harbour Lights** and one for the proposal **Fictional Ferry Proposal**.
    - Each entry has a checkbox.
  - **Notes:**

- [ ] **Step 8.** Select the checkbox of the entry for **Fictional Harbour Lights**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 9.** Select the checkbox of the entry for **Fictional Ferry Proposal**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 10.** Select **Approve 2 drafts**.
  - **Expected:** A dialog titled **Approve 2 drafts?** opens.
  - **Notes:**

- [ ] **Step 11.** Select **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 2 drafts.**
  - **Notes:**

- [ ] **Step 12.** Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens.
  - **Notes:**

- [ ] **Step 13.** On the **Projects** tab, select **Show features** in the ⋯ menu of **Fictional Harbour Lights**.
  - **Expected:**
    - The **Features** page opens showing only **Fictional Atlas**.
    - A pill above the table reads **Projects: FHL-1 Fictional Harbour Lights**.
  - **Notes:**

- [ ] **Step 14.** Select the **×** on the pill.
  - **Expected:** The pill is gone, and the table lists every feature.
  - **Notes:**

#### ACC-26: A Feature Status Is Added to Its List

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-25. Step 5 signs in as another account.

**Preconditions:** Signed in with this account. **Lists** page open from the left-hand menu.

- [ ] **Step 1.** Select **Feature statuses**.
  - **Expected:**
    - The panel opens with **Feature statuses** at the top.
    - A grey **Built in** box is after it.
    - Its choices are **Possible**, **Planned**, **In progress**, **Done** and **Cancelled**, each beside a meaning of the same name.
  - **Notes:**

- [ ] **Step 2.** In the empty row's meaning menu, choose **Possible**.
  - **Expected:** The empty row's meaning menu reads **Possible**.
  - **Notes:**

- [ ] **Step 3.** Type `Long shot` in the empty row's **Name** box, and press Enter.
  - **Expected:**
    - A row **Long shot** appears above the empty row, with a hollow yellow dot in its slot.
    - **Possible** is at the end of the row.
  - **Notes:**

- [ ] **Step 4.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 5.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] **Step 6.** Select the **Lists** page in the left-hand menu.
  - **Expected:** The **Lists** page opens.
  - **Notes:**

- [ ] **Step 7.** Select **Feature statuses**.
  - **Expected:** The panel opens with **Feature statuses** at the top.
  - **Notes:**

- [ ] **Step 8.** Select the **⋯** button at the end of the **Long shot** row, then **Approve…**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 9.** Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - **Long shot** has no dot.
  - **Notes:**

#### ACC-27: The Last Status for a Meaning Is Kept

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-26.

**Preconditions:** Signed in with this account. **Lists** page open, with the **Feature statuses** panel open.

- [ ] **Step 1.** Select the **⋯** button at the end of the **Cancelled** row.
  - **Expected:**
    - **Retire** and **Remove** are greyed out.
    - **Needed for Cancelled** is under them.
  - **Notes:**

- [ ] **Step 2.** Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button at the end of the **Possible** row.
  - **Expected:**
    - **Retire** can be selected.
    - No **Needed for** line is under it.
  - **Notes:**

- [ ] **Step 4.** Press Esc.
  - **Expected:**
    - The menu closes.
    - Nothing has changed.
  - **Notes:**

#### ACC-28: A Feature Lead's Change Is Rejected With a Reason

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-27. Step 3 signs in as another account.

**Preconditions:** ACC-26 done. Signed in with this account, acting as **Feature Lead**. **Features** page open.

- [ ] **Step 1.** In the row **Partner Portal**, select the **Status** cell, press Enter, choose **Long shot**, and press Enter.
  - **Expected:**
    - The cell reads **Long shot**, with a hollow yellow dot before it.
    - The row is faintly yellow.
    - A Live row under it reads **Possible**.
  - **Notes:**

- [ ] **Step 2.** Run Publish.
  - **Expected:** The dot before **Long shot** in the **Partner Portal** row is filled yellow.
  - **Notes:**

- [ ] **Step 3.** Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Product Manager**.
  - **Notes:**

- [ ] **Step 4.** Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] **Step 5.** Open the ⋯ menu of **Partner Portal**.
  - **Expected:**
    - The menu names the change to **Status**.
    - It offers **Approve draft** and **Reject draft…**.
  - **Notes:**

- [ ] **Step 6.** Select **Reject draft…**.
  - **Expected:**
    - A dialog titled **Reject 1 draft?** opens.
    - It has a **Reason** box.
  - **Notes:**

- [ ] **Step 7.** Type `Fictional reason: wait for the customer day.` in **Reason**.
  - **Expected:** **Reason** shows what was typed.
  - **Notes:**

- [ ] **Step 8.** Select **Reject**.
  - **Expected:**
    - A notice reads **Rejected 1 draft.**
    - In the **Partner Portal** row, **Long shot** has a red dot in a ring before it.
    - The row is faintly red.
  - **Notes:**

#### ACC-29: A Rejected Change Is Resubmitted and Approved

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-28. Step 3 signs in as another account.

**Preconditions:** ACC-28 done. Signed in with this account, acting as **Feature Lead**. **Features** page open.

- [ ] **Step 1.** Open the ⋯ menu of **Partner Portal**.
  - **Expected:**
    - The menu shows a red dot in a ring, then **Rejected**.
    - Under it, **Reason: Fictional reason: wait for the customer day.**
    - The menu offers **Resubmit** and **Discard draft**.
  - **Notes:**

- [ ] **Step 2.** Select **Resubmit**.
  - **Expected:**
    - The dot before **Long shot** is solid yellow.
    - The row is faintly yellow.
  - **Notes:**

- [ ] **Step 3.** Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Product Manager**.
  - **Notes:**

- [ ] **Step 4.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 5.** Type `Partner Portal` in the search box.
  - **Expected:**
    - One entry is shown, for the feature **Partner Portal**.
    - It was made by **Feature Lead**.
    - It has a checkbox.
  - **Notes:**

- [ ] **Step 6.** Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 7.** Select **Approve 1 draft**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 8.** Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads **Approved 1 draft.**
    - The page says **No drafts match the search.**
  - **Notes:**

- [ ] **Step 9.** Select **Features**.
  - **Expected:**
    - **Partner Portal** reads **Long shot** in **Status**.
    - It has no dot.
  - **Notes:**

#### ACC-30: The Change History Tells How a Draft Went

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from ACC-29.

**Preconditions:** ACC-29 done. Signed in with this account.

- [ ] **Step 1.** Select the **Change history** page in the left-hand menu.
  - **Expected:** The **Change history** page opens.
  - **Notes:**

- [ ] **Step 2.** Type `Partner Portal` in the search box.
  - **Expected:** The entries, newest first, say that:
    - Product Manager approved the changes to **Partner Portal**
    - Feature Lead sent its draft for approval again
    - Product Manager rejected its draft, with the reason **Fictional reason: wait for the customer day.**
    - Feature Lead drafted changing **Status** from **Possible** to **Long shot**
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu, and read the entries.
  - **Expected:** In dark mode, the entries are easy to read.
  - **Notes:**

- [ ] **Step 4.** Choose **Light** in the Appearance menu.
  - **Expected:** In light mode, the entries are easy to read.
  - **Notes:**

#### ACC-31: A Shorter Cycle Moves a Release and Its Features

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, in the main browser, changed from ACC-30. The second browser is still signed in as the Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, from ACC-14; steps 2 and 3 act there. Step 9 signs in as another account in the main browser.

**Preconditions:** Signed in with this account. **Releases** page open from the left-hand menu, with **Platform** selected in the streams table.

- [ ] **Step 1.** Look at the side panel's heading and its **Cycles** table.
  - **Expected:**
    - The heading reads **Platform**, with a grey lock before it.
    - The rows of the **Cycles** table have no **⋯** button.
  - **Notes:**

- [ ] **Step 2.** In the second browser, reload the page.
  - **Expected:** The top bar shows the Publish button.
  - **Notes:**

- [ ] **Step 3.** In the second browser, run Discard the Unpublished Changes.
  - **Expected:**
    - A notice says **Discarded** followed by the number of changes.
    - The Publish button is gone.
  - **Notes:**

- [ ] **Step 4.** In the main browser, reload the page.
  - **Expected:**
    - The side panel's heading reads **Platform**.
    - No lock is before it.
  - **Notes:**

- [ ] **Step 5.** In the side panel's **Cycles** table, select the **⋯** button at the end of next quarter's cycle, then **Change length…**.
  - **Expected:**
    - A dialog titled **Change the length of** that cycle opens.
    - **Length** reads **3**, followed by **months**.
    - Under **Later cycles**, **Move with it** is selected.
  - **Notes:**

- [ ] **Step 6.** Replace **3** in **Length** with `2`.
  - **Expected:**
    - **New dates** lists that cycle two months long.
    - Each later cycle in **New dates** starts the day after the one before it ends.
    - **Releases that move** names **Harbor 3** and **Harbor 4**.
    - **Features that move** names **Data Retention Controls** and **Report Builder**.
  - **Notes:**

- [ ] **Step 7.** Select **Change length**.
  - **Expected:** A notification says **Drafted the new length.**
  - **Notes:**

- [ ] **Step 8.** Run Publish.
  - **Expected:** Under **Releases**, in the **Harbor 3** row:
    - A yellow dot in its slot, then **Harbor 3** and the yellow **Moved** box
    - Its cycles run from the cycle after next quarter's to the second half-year cycle
    - It ships on the second half-year cycle's new last day
  - **Notes:**

- [ ] **Step 9.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] **Step 10.** Select the **Releases** page in the left-hand menu.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] **Step 11.** Select **Platform** in the streams table.
  - **Expected:** The side panel's heading reads **Platform**.
  - **Notes:**

- [ ] **Step 12.** Select the **⋯** button at the end of the **Harbor 3** row, then **Approve…**.
  - **Expected:** A dialog titled **Approve 6 drafts?** says **Also approves the drafts these depend on:**, listing:
    - Three entries for **the cycles of Platform from** a day
    - **the feature Data Retention Controls**
    - **the feature Report Builder**
  - **Notes:**

- [ ] **Step 13.** Select **Approve**.
  - **Expected:**
    - A notification says **Approved 6 drafts.**
    - No row under **Cycle schedule** has a dot.
    - **Harbor 3** has no dot and no box.
    - **Harbor 3** still ships on the second half-year cycle's new last day.
  - **Notes:**

#### ACC-32: A Product Manager Makes a Release

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-31. Step 7 signs in as another account.

**Preconditions:** Signed in with this account. **Releases** page open from the left-hand menu, with **Platform** selected in the streams table.

- [ ] **Step 1.** Select **New release…** under **Releases** in the side panel.
  - **Expected:**
    - A dialog titled **New release in Platform** opens.
    - It has **Name**, **First cycle**, **Last cycle** and an empty **Ships on**.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional Harbor 4` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 3.** Choose the last cycle in the list in **First cycle**.
  - **Expected:** **First cycle** shows the cycle chosen.
  - **Notes:**

- [ ] **Step 4.** Choose the last cycle in the list in **Last cycle**.
  - **Expected:** Under **Ships on**, the dialog reads **Leave empty to ship at the end of its last cycle, on** that cycle's last day.
  - **Notes:**

- [ ] **Step 5.** Select **Make release**.
  - **Expected:** A notification says **Drafted the new release.**
  - **Notes:**

- [ ] **Step 6.** Run Publish.
  - **Expected:** Under **Releases**, a row reads **Fictional Harbor 4**, with a yellow dot in its slot.
  - **Notes:**

- [ ] **Step 7.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] **Step 8.** Select the **Releases** page in the left-hand menu.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] **Step 9.** Select **Platform** in the streams table.
  - **Expected:** The side panel's heading reads **Platform**.
  - **Notes:**

- [ ] **Step 10.** Select the **⋯** button at the end of the **Fictional Harbor 4** row, then **Approve…**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 11.** Select **Approve** in the dialog.
  - **Expected:**
    - A notification says **Approved 1 draft.**
    - **Fictional Harbor 4** has no dot.
  - **Notes:**

#### ACC-33: An Executive Reads the Plan

**Account:** Executive, `executive@fathom.test`, changed from ACC-32.

**Preconditions:** ACC-32 done. Signed in with this account. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:**
    - The **Overview** page is open.
    - The **Plan** section shows **Overview**, **Projects**, **Features** and **Releases**.
    - The **People** section shows **People**, **Org chart**, **Feature assignments**, **Drafts**, **Capacity** and **Lists**.
    - The **Administration** section shows **Accounts**, **Roles** and **Settings**.
    - The **History** section shows **Change history** and **Access history**.
    - The menu shows the **Help** section.
  - **Notes:**

- [ ] **Step 2.** Select **Releases**.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] **Step 3.** Select **Platform** in the streams table.
  - **Expected:**
    - There is no **New release stream** button.
    - There is no **New release…** button.
    - **Harbor 1**, **Harbor 3** and **Fictional Harbor 4** have no **⋯** button at their end.
  - **Notes:**

- [ ] **Step 4.** Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] **Step 5.** Select **All** on the timeline.
  - **Expected:**
    - The whole timeline fits across.
    - **Fictional Harbor 4** is at the right end of **Platform**'s releases lane.
    - A diamond is under the right end of **Fictional Harbor 4**.
  - **Notes:**

- [ ] **Step 6.** Hover over **Fictional Harbor 4**'s span.
  - **Expected:** A tooltip names **Fictional Harbor 4**, its cycle and the day it ships.
  - **Notes:**

- [ ] **Step 7.** Select **Features**.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] **Step 8.** Select **Group by: Cycle** above the table, then **Needed by**.
  - **Expected:**
    - Each heading names a month and year, such as **Mar 2027**, with how many features it holds.
    - The headings run from the earliest month to the latest.
    - The last heading is **No date**.
    - There is no **New feature** button.
  - **Notes:**

- [ ] **Step 9.** Select **Group by: Needed by**, then **Cycle**.
  - **Expected:** The headings name cycles, with **Later** last.
  - **Notes:**

- [ ] **Step 10.** Choose **Dark** in the Appearance menu, and look over the table.
  - **Expected:** In dark mode, every word, the group headings and the lines between rows are easy to read.
  - **Notes:**

- [ ] **Step 11.** Choose **Light** in the Appearance menu.
  - **Expected:** The page is light.
  - **Notes:**

#### ACC-34: An Executive Sees People and Administration Without Changing Them

**Account:** Executive, `executive@fathom.test`, the same as ACC-33.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select **People**.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] **Step 2.** Search for `Chatura Abbott`.
  - **Expected:**
    - Her row is shown, with a date after today in **Start**.
    - The table has **Start** and **End** columns.
    - There is no **New** and no **New column** button.
  - **Notes:**

- [ ] **Step 3.** Select **Drafts**.
  - **Expected:**
    - Drafts are listed, with no checkboxes.
    - There is no **Select all waiting** or **Approve** button.
  - **Notes:**

- [ ] **Step 4.** Select **Accounts**.
  - **Expected:**
    - Every account is in the table with its roles.
    - There is no **New account** button.
    - There is no **Edit** button in any row.
  - **Notes:**

#### ACC-35: A Team Member Reads the Plan Without Changing It

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-34.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Look at the left-hand menu.
  - **Expected:**
    - The **Plan** section shows **Overview**, **Projects**, **Features** and **Releases**.
    - The **People** section shows **People**, **Org chart**, **Feature assignments** and **Drafts**.
    - The **History** section shows **Change history**.
    - The menu shows the **Help** section.
  - **Notes:**

- [ ] **Step 2.** Select **Features**.
  - **Expected:**
    - The table shows **Fictional Atlas** and **Partner Portal** reading **Long shot**.
    - There is no **New feature** button.
    - There is no empty row at the table's end.
  - **Notes:**

- [ ] **Step 3.** Double-click the **Status** cell of any row.
  - **Expected:** The cell does not open for editing.
  - **Notes:**

- [ ] **Step 4.** Select **Releases**.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] **Step 5.** Select **Platform** in the streams table.
  - **Expected:**
    - **Fictional Harbor 4** is under **Releases**.
    - **Harbor 1**, **Harbor 3** and **Fictional Harbor 4** have no **⋯** button.
    - There is no **New release…** button.
  - **Notes:**

#### ACC-36: Removing a Project Removes Its Milestones

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-35. Step 3 signs in as another account.

**Preconditions:** ACC-22 done. Signed in with this account. **Projects** page open, on the **Projects** tab.

- [ ] **Step 1.** Open the ⋯ menu of **Fictional Harbour Lights**, and select **Remove project**.
  - **Expected:**
    - **Fictional Harbour Lights** has a hollow yellow dot in its slot.
    - Its row is struck through.
  - **Notes:**

- [ ] **Step 2.** Run Publish.
  - **Expected:** The dot is filled yellow.
  - **Notes:**

- [ ] **Step 3.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] **Step 4.** Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens.
  - **Notes:**

- [ ] **Step 5.** Open the ⋯ menu of **Fictional Harbour Lights**, and select **Approve draft**.
  - **Expected:**
    - The dialog names the removal of **the project Fictional Harbour Lights**.
    - As drafts it includes, it names the removal of **Pilot** and **Go live**.
  - **Notes:**

- [ ] **Step 6.** Select **Approve** in the dialog.
  - **Expected:** **Fictional Harbour Lights** is no longer listed.
  - **Notes:**

- [ ] **Step 7.** Select the **Milestones** tab.
  - **Expected:** **Pilot** and **Go live** of **Fictional Harbour Lights** are no longer listed.
  - **Notes:**

### Journey 5: Administration

#### ACC-37: A New Account Signs In for the First Time

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, changed from ACC-36. The second browser signs in as the new account in step 9.

**Preconditions:** Signed in with this account in the main browser. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Look at the left-hand menu.
  - **Expected:**
    - The **Administration** section shows **Accounts**, **Roles** and **Settings**.
    - The **History** section shows **Access history**.
    - The menu shows the **Help** section.
    - It shows no page of the plan or of people.
  - **Notes:**

- [ ] **Step 2.** Select **Accounts**.
  - **Expected:** The **Accounts** page opens.
  - **Notes:**

- [ ] **Step 3.** Select **New account**.
  - **Expected:**
    - A dialog titled **New account** opens.
    - **Name** and **Email address** are empty.
    - **Roles** lists every role, each with a square tick box and its description.
    - Only **Team Member** is ticked.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional Newcomer` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 5.** Type `fictional.newcomer@fathom.test` in **Email address**.
  - **Expected:** **Email address** shows what was typed.
  - **Notes:**

- [ ] **Step 6.** Select **Create account**.
  - **Expected:** The dialog, titled **Password for Fictional Newcomer**, says **This password is shown only once. Fictional Newcomer must change it at the next sign-in.**
  - **Notes:**

- [ ] **Step 7.** Select the eye button, and write the password down.
  - **Expected:** The eye button shows the password.
  - **Notes:**

- [ ] **Step 8.** Select **Done**.
  - **Expected:**
    - A green banner says **Created the account for Fictional Newcomer.**
    - The table has a **Fictional Newcomer** row with **Team Member** in **Roles**.
  - **Notes:**

- [ ] **Step 9.** In the second browser, sign out if signed in, and sign in as the new account, `fictional.newcomer@fathom.test`, with the password written down.
  - **Expected:**
    - A panel headed **Change password** says **Fathom generated this password. A new password is required to continue.**
    - There is no left-hand menu.
  - **Notes:**

- [ ] **Step 10.** Enter the password written down in **Current password**.
  - **Expected:** **Current password** is filled in.
  - **Notes:**

- [ ] **Step 11.** Enter `fictional password 2` in **New password**.
  - **Expected:** **New password** is filled in.
  - **Notes:**

- [ ] **Step 12.** Enter `fictional password 2` in **New password again**.
  - **Expected:** **New password again** is filled in.
  - **Notes:**

- [ ] **Step 13.** Select **Change password**.
  - **Expected:**
    - A green banner says **The password has been changed, and every other session has been signed out.**
    - Fathom opens on the **Overview**.
    - The left-hand menu is shown.
  - **Notes:**

#### ACC-38: A Copied Role Is Given to the New Account

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ACC-37. The second browser stays signed in as the new account.

**Preconditions:** ACC-37 done. **Roles** page open from the left-hand menu.

- [ ] **Step 1.** Select **Copy** in the **Team Member** row.
  - **Expected:**
    - A dialog titled **Copy Team Member** opens.
    - The name reads **Copy of Team Member**.
    - **View** is ticked on **Plan**, **Features and releases**, **Allocations**, **People** and **Feature teams**.
    - Its main button is **Create role**.
  - **Notes:**

- [ ] **Step 2.** Replace the name with `Fictional Reader`.
  - **Expected:** The name reads **Fictional Reader**.
  - **Notes:**

- [ ] **Step 3.** Tick **View** on **Configuration**.
  - **Expected:** **View** on **Configuration** is ticked.
  - **Notes:**

- [ ] **Step 4.** Select **Create role**.
  - **Expected:**
    - A green banner says **The role has been created.**
    - **Fictional Reader** is in the list with 0 accounts.
  - **Notes:**

- [ ] **Step 5.** Select **Accounts**.
  - **Expected:** The **Accounts** page opens.
  - **Notes:**

- [ ] **Step 6.** Select **Edit** in the **Fictional Newcomer** row.
  - **Expected:** A dialog titled **Edit Fictional Newcomer** opens.
  - **Notes:**

- [ ] **Step 7.** Tick **Fictional Reader**.
  - **Expected:** **Fictional Reader** is ticked.
  - **Notes:**

- [ ] **Step 8.** Untick **Team Member**.
  - **Expected:** **Team Member** is not ticked.
  - **Notes:**

- [ ] **Step 9.** Select **Save**.
  - **Expected:**
    - A green banner says **Saved the account for Fictional Newcomer.**
    - The row's **Roles** cell shows **Fictional Reader**.
  - **Notes:**

- [ ] **Step 10.** In the second browser, reload the page.
  - **Expected:** The left-hand menu shows **Lists** in the **People** section.
  - **Notes:**

#### ACC-39: Restore Template Brings Back a Starting Role

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ACC-38.

**Preconditions:** **Roles** page open.

- [ ] **Step 1.** Select **Edit** in the **Executive** row.
  - **Expected:** The role dialog opens.
  - **Notes:**

- [ ] **Step 2.** Tick **Edit** on the **Plan** row.
  - **Expected:**
    - **What it is for** is empty.
    - A line under it reads **What the role grants changed, so its old summary is gone.**
    - **Restore template** is turned on.
  - **Notes:**

- [ ] **Step 3.** Select **Restore template**.
  - **Expected:**
    - **What it is for** reads **Sees the plan, people, with their Personal and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them.**
    - **Edit** on **Plan** is unticked.
    - **Restore template** is turned off.
  - **Notes:**

- [ ] **Step 4.** Select **Cancel**.
  - **Expected:**
    - The dialog closes.
    - The **Executive** row's description reads **Sees the plan, people, with their Personal and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them.**
  - **Notes:**

#### ACC-40: A Deactivated Account Is Signed Out, Then Reactivated

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ACC-39. The second browser stays signed in as the new account.

**Preconditions:** ACC-38 done. **Accounts** page open.

- [ ] **Step 1.** Select **Edit** in the **Fictional Newcomer** row.
  - **Expected:** A dialog titled **Edit Fictional Newcomer** opens.
  - **Notes:**

- [ ] **Step 2.** Select **Deactivate**.
  - **Expected:**
    - A dialog titled **Deactivate Fictional Newcomer** says **Fictional Newcomer will be signed out everywhere, and will not be able to sign in until the account is reactivated.**
    - It offers **Cancel** and a red **Deactivate**.
  - **Notes:**

- [ ] **Step 3.** Select **Deactivate**.
  - **Expected:**
    - A green banner says **Deactivated the account for Fictional Newcomer.**
    - The row says **Deactivated**, in grey.
  - **Notes:**

- [ ] **Step 4.** In the second browser, select any page in the left-hand menu.
  - **Expected:** The **Sign in** page opens.
  - **Notes:**

- [ ] **Step 5.** In the main browser, select **Deactivated 1** in the filter beside the search box.
  - **Expected:** Only the **Fictional Newcomer** row is listed.
  - **Notes:**

- [ ] **Step 6.** Select **Edit** in the **Fictional Newcomer** row.
  - **Expected:** A dialog titled **Edit Fictional Newcomer** opens.
  - **Notes:**

- [ ] **Step 7.** Select **Reactivate**.
  - **Expected:** A dialog opens with a **Reactivate** button.
  - **Notes:**

- [ ] **Step 8.** Select **Reactivate** in the dialog.
  - **Expected:**
    - A green banner says **Reactivated the account for Fictional Newcomer.**
    - The filter reads **Deactivated 0**.
  - **Notes:**

- [ ] **Step 9.** In the second browser, sign in as the new account, `fictional.newcomer@fathom.test`, with `fictional password 2`.
  - **Expected:**
    - Fathom opens.
    - **Change history** is in the left-hand menu.
  - **Notes:**

#### ACC-41: The Access History Records What Was Done to the Account

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ACC-40.

**Preconditions:** ACC-37 to ACC-40 done.

- [ ] **Step 1.** Select the **Access history** page in the left-hand menu.
  - **Expected:** The **Access history** page opens.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional Newcomer` in the search box at the top of the page.
  - **Expected:** The entries include, from newest to oldest:
    - Fathom Administrator **reactivated the account for** Fictional Newcomer
    - Fathom Administrator **deactivated the account for** Fictional Newcomer, marked as worth checking
    - Fathom Administrator **changed the role of** Fictional Newcomer, from Team Member to Fictional Reader, marked as worth checking
    - Fictional Newcomer **changed their own password**
    - Fathom Administrator **created the account for** Fictional Newcomer
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu, and read the entries.
  - **Expected:** In dark mode, the entries and their marks are easy to read.
  - **Notes:**

- [ ] **Step 4.** Choose **Light** in the Appearance menu.
  - **Expected:** In light mode, the entries and their marks are easy to read.
  - **Notes:**

#### ACC-42: Switching Role Changes What Can Be Done at Once

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, changed from ACC-41.

**Preconditions:** Signed in with this account, acting as **Feature Lead**. **Releases** page open, with **Platform** selected in the streams table.

- [ ] **Step 1.** Open the account menu.
  - **Expected:**
    - **Role** lists **Engineering Manager** and **Feature Lead**.
    - A tick is beside **Feature Lead** only.
  - **Notes:**

- [ ] **Step 2.** Press Esc, and look under **Releases** in the side panel.
  - **Expected:**
    - **Harbor 1**, **Harbor 3** and **Fictional Harbor 4** have no **⋯** button.
    - There is no **New release…** button.
  - **Notes:**

- [ ] **Step 3.** Choose **Engineering Manager** in the role menu.
  - **Expected:**
    - The menu closes.
    - The page stays on **Releases** with **Platform** open, without the browser reloading.
    - Each row under **Releases** now ends with a **⋯** button.
    - **New release…** shows.
  - **Notes:**

#### ACC-43: The Change History Names the Role a Change Was Made As

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, the same as ACC-42.

**Preconditions:** ACC-42 done, acting as **Engineering Manager**. **Releases** page open, with **Platform** selected in the streams table.

- [ ] **Step 1.** Select the **⋯** button at the end of the **Harbor 3** row, then **Change…**.
  - **Expected:**
    - A dialog titled **Change Harbor 3** opens.
    - **Name** holds **Harbor 3**.
  - **Notes:**

- [ ] **Step 2.** Replace the name with `Fictional Harbor Three`.
  - **Expected:** **Name** holds **Fictional Harbor Three**.
  - **Notes:**

- [ ] **Step 3.** Select **Save**.
  - **Expected:**
    - A notification says **Drafted the change to the release.**
    - The row reads **Fictional Harbor Three**, with a hollow yellow dot before it.
  - **Notes:**

- [ ] **Step 4.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 5.** Select the **Change history** page in the left-hand menu.
  - **Expected:**
    - The latest entry names **Fictional Harbor Three**.
    - It starts with **Feature Lead as Engineering Manager**.
  - **Notes:**

- [ ] **Step 6.** Select **Releases**.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] **Step 7.** Select **Platform** in the streams table.
  - **Expected:** The side panel's heading reads **Platform**.
  - **Notes:**

- [ ] **Step 8.** Select the **⋯** button at the end of the **Fictional Harbor Three** row, then **Discard draft**.
  - **Expected:**
    - A notification says **Discarded the draft.**
    - The row reads **Harbor 3**, with no dot.
  - **Notes:**

- [ ] **Step 9.** Choose **Feature Lead** in the role menu.
  - **Expected:** **Harbor 1**, **Harbor 3** and **Fictional Harbor 4** have no **⋯** button.
  - **Notes:**

#### ACC-44: Each Browser Keeps Its Own Appearance

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, changed from ACC-43. Step 4 signs in again with this account.

**Preconditions:** The computer's appearance set to light. Signed in with this account. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Choose **Dark** in the Appearance menu.
  - **Expected:** The whole page turns dark at once: the sidebar, the page and the top bar.
  - **Notes:**

- [ ] **Step 2.** Reload the page.
  - **Expected:** The page opens dark.
  - **Notes:**

- [ ] **Step 3.** Sign out.
  - **Expected:** The **Sign in** page is dark.
  - **Notes:**

- [ ] **Step 4.** Sign in with this account again.
  - **Expected:** The page is dark.
  - **Notes:**

- [ ] **Step 5.** Choose **System** in the Appearance menu.
  - **Expected:** The page turns light when **System** is chosen.
  - **Notes:**

- [ ] **Step 6.** Set the computer's appearance to dark.
  - **Expected:** The page turns dark when the computer's appearance is set to dark.
  - **Notes:**

- [ ] **Step 7.** Set the computer's appearance back to light.
  - **Expected:** The page turns light when the computer's appearance is set back to light.
  - **Notes:**

- [ ] **Step 8.** Choose **Light** in the Appearance menu.
  - **Expected:**
    - The page stays light.
    - The tick in the menu is beside **Light**.
  - **Notes:**

#### ACC-45: Put Everything Back

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ACC-44. Step 1 signs in again with this account.

**Preconditions:** All the test cases above run.

- [ ] **Step 1.** Run Reset the Database, signing in again as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** The top bar's right end reads **Fathom Administrator**.
  - **Notes:**

- [ ] **Step 2.** Select the **Accounts** page in the left-hand menu.
  - **Expected:** The table lists the development accounts, with no **Fictional Newcomer**.
  - **Notes:**

- [ ] **Step 3.** Select the **Roles** page in the left-hand menu.
  - **Expected:**
    - The roles are listed as [Roles](../product/roles.md#starting-roles) sets out.
    - The Superuser role is listed.
    - There is no **Fictional Reader**.
  - **Notes:**

### Journey 6: An Organization Starts From Nothing

#### ACC-46: The Administrator Adds an Account With Two Roles

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ACC-45.

**Preconditions:** Start From an Empty Database run. Signed in with this account. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select the **Accounts** page in the left-hand menu.
  - **Expected:**
    - The table lists the development accounts, as [Development Setup](../design/development-setup.md#development-accounts) lists them, and no other.
    - The filter beside the search box reads **All 12**, **Active 12** and **Deactivated 0**.
  - **Notes:**

- [ ] **Step 2.** Select **New account**.
  - **Expected:** A dialog titled **New account** opens.
  - **Notes:**

- [ ] **Step 3.** Type `Fictional Planning Lead` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 4.** Type `fictional.planning.lead@fathom.test` in **Email address**.
  - **Expected:** **Email address** shows what was typed.
  - **Notes:**

- [ ] **Step 5.** Under **Roles**, tick **Product Manager**.
  - **Expected:**
    - **Product Manager** is ticked.
    - **Default role** is under the roles.
  - **Notes:**

- [ ] **Step 6.** Tick **Workforce Administrator**.
  - **Expected:** **Workforce Administrator** is ticked.
  - **Notes:**

- [ ] **Step 7.** Untick **Team Member**.
  - **Expected:** **Default role** offers **Product Manager** and **Workforce Administrator**, in the order of the role list.
  - **Notes:**

- [ ] **Step 8.** Choose **Workforce Administrator** under **Default role**.
  - **Expected:** **Workforce Administrator** is chosen under **Default role**.
  - **Notes:**

- [ ] **Step 9.** Select **Create account**.
  - **Expected:** The dialog is titled **Password for Fictional Planning Lead**.
  - **Notes:**

- [ ] **Step 10.** Select the eye button, and write the password down.
  - **Expected:** The eye button shows the password.
  - **Notes:**

- [ ] **Step 11.** Select **Done**.
  - **Expected:**
    - A green banner says **Created the account for Fictional Planning Lead.**
    - The row's **Roles** cell shows **Workforce Administrator (default)** then **Product Manager**.
  - **Notes:**

#### ACC-47: People Are Pasted Into an Empty People Table and Approved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-46. Step 11 signs in as another account.

**Preconditions:** ACC-46 done. Signed in with this account. In the text editor, seven lines, typed with the Tab key where shown:

- **Odile Brandt**, Tab, **EMP-100**, Tab, **Manager**, Tab, **Hired**
- **Ada Quill**, Tab, **EMP-101**, Tab, **Manager**, Tab, **Hired**
- **Bram Oakes**, Tab, **EMP-102**, Tab, **Employee**, Tab, **Hired**
- **Cleo Marsh**, Tab, **EMP-103**, Tab, **Employee**, Tab, **Hired**
- **Dara Finch**, Tab, **EMP-104**, Tab, **Employee**, Tab, **Hired**
- **Emil Stone**, Tab, **EMP-105**, Tab, **Employee**, Tab, **Hired**
- **Freya Holt**, Tab, **EMP-106**, Tab, **Employee**, Tab, **Hired**

- [ ] **Step 1.** Select the **People** page in the left-hand menu.
  - **Expected:**
    - The table has its column names and only the empty row.
    - The count above the table reads **0 people**.
  - **Notes:**

- [ ] **Step 2.** Select the **Org chart** page in the left-hand menu.
  - **Expected:** The page reads **Nobody is on the org chart yet.**
  - **Notes:**

- [ ] **Step 3.** Select the **Change history** page in the left-hand menu.
  - **Expected:** The page reads **No changes yet to data this account can see.**
  - **Notes:**

- [ ] **Step 4.** Select **People**.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] **Step 5.** Copy the seven lines from the text editor.
  - **Expected:** The seven lines are highlighted in the text editor.
  - **Notes:**

- [ ] **Step 6.** In Fathom, select the **Name** cell of the empty row.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] **Step 7.** Paste.
  - **Expected:**
    - Seven rows are added, one for each line.
    - Each row has its ID.
    - Each row reads **Manager** or **Employee** in **Position**.
    - Each row reads **Hired** in **State**.
    - Each row has a hollow yellow dot in its slot.
    - The count reads **7 people**.
  - **Notes:**

- [ ] **Step 8.** Click once in the **Manager?** cell of **Odile Brandt**.
  - **Expected:** Her box is checked.
  - **Notes:**

- [ ] **Step 9.** Click once in the **Manager?** cell of **Ada Quill**.
  - **Expected:**
    - Both boxes are checked.
    - The other rows' boxes stay clear.
  - **Notes:**

- [ ] **Step 10.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 11.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] **Step 12.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 13.** Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 7 drafts**.
  - **Notes:**

- [ ] **Step 14.** Select **Approve 7 drafts**.
  - **Expected:** A dialog titled **Approve 7 drafts?** opens.
  - **Notes:**

- [ ] **Step 15.** Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads **Approved 7 drafts.**
    - The page says **No drafts waiting for approval.**
  - **Notes:**

#### ACC-48: Reporting Lines and a Planned Hire Are Added

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-47. Step 16 signs in as another account.

**Preconditions:** ACC-47 done. Signed in with this account. **People** page open.

- [ ] **Step 1.** Select the **Manager** cell of **Bram Oakes**, press Enter, type `Ada`, and choose **Ada Quill**.
  - **Expected:**
    - The **Manager** cell reads **Ada Quill**, with a hollow yellow dot before it.
    - **Manager assigned** holds today's date.
  - **Notes:**

- [ ] **Step 2.** Select the **Manager** cell of **Cleo Marsh**, press Enter, type `Ada`, and choose **Ada Quill**.
  - **Expected:** The **Manager** cell of **Cleo Marsh** reads **Ada Quill**, with a hollow yellow dot before it.
  - **Notes:**

- [ ] **Step 3.** Select the **Manager** cell of **Freya Holt**, press Enter, type `Ada`, and choose **Ada Quill**.
  - **Expected:** The **Manager** cell of **Freya Holt** reads **Ada Quill**, with a hollow yellow dot before it.
  - **Notes:**

- [ ] **Step 4.** Select the **Manager** cell of **Ada Quill**, press Enter, type `Odile`, and choose **Odile Brandt**.
  - **Expected:** The **Manager** cell of **Ada Quill** reads **Odile Brandt**, with a hollow yellow dot before it.
  - **Notes:**

- [ ] **Step 5.** Select the **Manager** cell of **Dara Finch**, press Enter, type `Odile`, and choose **Odile Brandt**.
  - **Expected:** The **Manager** cell of **Dara Finch** reads **Odile Brandt**, with a hollow yellow dot before it.
  - **Notes:**

- [ ] **Step 6.** Select the **Manager** cell of **Emil Stone**, press Enter, type `Odile`, and choose **Odile Brandt**.
  - **Expected:**
    - Each of the six rows reads its new manager, with a hollow yellow dot before it.
    - **Odile Brandt** has no manager.
  - **Notes:**

- [ ] **Step 7.** Select **New** at the top right of the page.
  - **Expected:** The details panel opens, headed **New person**.
  - **Notes:**

- [ ] **Step 8.** Select the change button beside **State**, and choose **Request to hire**.
  - **Expected:** **State** reads **Request to hire**.
  - **Notes:**

- [ ] **Step 9.** Type `Fictional tide engineer` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 10.** Type `REQ-7001` in **ID**.
  - **Expected:** **ID** shows what was typed.
  - **Notes:**

- [ ] **Step 11.** Type the first day of three months from now in **Start**, such as `20270201`.
  - **Expected:** **Start** shows the date typed.
  - **Notes:**

- [ ] **Step 12.** Choose **Employee** in **Position** from its change button.
  - **Expected:** **Position** reads **Employee**.
  - **Notes:**

- [ ] **Step 13.** Choose **Ada Quill** in **Manager** from its change button.
  - **Expected:** **Manager** reads **Ada Quill**.
  - **Notes:**

- [ ] **Step 14.** Select **Add**.
  - **Expected:**
    - The panel shows **Fictional tide engineer**.
    - Its row reads **Request to hire** in **State** and **Ada Quill** in **Manager**.
    - Its row has a hollow yellow dot in its slot.
  - **Notes:**

- [ ] **Step 15.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 16.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 17.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 18.** Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 7 drafts**.
  - **Notes:**

- [ ] **Step 19.** Select **Approve 7 drafts**.
  - **Expected:** A dialog titled **Approve 7 drafts?** opens.
  - **Notes:**

- [ ] **Step 20.** Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads **Approved 7 drafts.**
    - The page says **No drafts waiting for approval.**
  - **Notes:**

#### ACC-49: A Team Member Reads the New Organization

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-48.

**Preconditions:** ACC-48 done. Signed in with this account. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select the **Org chart** page in the left-hand menu.
  - **Expected:**
    - **Odile Brandt** is at the top, with **Manager** under the name.
    - Her card ends with **Hide 3 reports**.
    - **Dara Finch** and **Emil Stone** are in a column under her.
    - **Ada Quill**, with **Manager** under the name, is to the right of that column.
    - Her card ends with **Show 4 reports**.
  - **Notes:**

- [ ] **Step 2.** On the card for **Ada Quill**, select **Show 4 reports**.
  - **Expected:**
    - **Bram Oakes**, **Cleo Marsh** and **Freya Holt** appear in a column under her.
    - After them is a card with a grey dashed edge for **Fictional tide engineer**.
    - On that card, **Employee** is under the name.
    - On that card, under **Employee**, a grey box reads **Planned, expected** and the month three months from now.
  - **Notes:**

- [ ] **Step 3.** Choose **Feature teams** in the teams switch.
  - **Expected:** The Feature teams button shows above the chart.
  - **Notes:**

- [ ] **Step 4.** Select the Feature teams button.
  - **Expected:**
    - The menu reads **No feature teams yet**.
    - It offers no **New feature team**.
  - **Notes:**

#### ACC-50: The Planning Lead Sets Up a Release Stream and Makes a Release

**Account:** Planning lead, `fictional.planning.lead@fathom.test`, changed from ACC-49.

**Preconditions:** ACC-46 done. Signed out.

- [ ] **Step 1.** Sign in as the planning lead, with the password written down in ACC-46.
  - **Expected:** A panel headed **Change password** says **Fathom generated this password. A new password is required to continue.**
  - **Notes:**

- [ ] **Step 2.** Enter the password written down in **Current password**.
  - **Expected:** **Current password** is filled in.
  - **Notes:**

- [ ] **Step 3.** Enter `fictional password 3` in **New password**.
  - **Expected:** **New password** is filled in.
  - **Notes:**

- [ ] **Step 4.** Enter `fictional password 3` in **New password again**.
  - **Expected:** **New password again** is filled in.
  - **Notes:**

- [ ] **Step 5.** Select **Change password**.
  - **Expected:**
    - A green banner says **The password has been changed, and every other session has been signed out.**
    - Fathom opens with the left-hand menu.
  - **Notes:**

- [ ] **Step 6.** Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The page reads **No release streams yet.**
    - A **New release stream** button is at the top right.
  - **Notes:**

- [ ] **Step 7.** Select **New release stream**.
  - **Expected:** A dialog titled **New release stream** opens.
  - **Notes:**

- [ ] **Step 8.** Type `Fictional Mainline` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 9.** Select **Add stream**.
  - **Expected:**
    - A notification says **Drafted the new release stream.**
    - The side panel is headed with a hollow yellow dot before **Fictional Mainline**.
    - **No cycles yet.** is under **Cycle schedule**.
    - **No releases yet.** is under **Releases**.
    - There is no **New release…** button.
  - **Notes:**

- [ ] **Step 10.** Select **Set up cycles…**.
  - **Expected:** A dialog titled **Set up cycles for Fictional Mainline** opens.
  - **Notes:**

- [ ] **Step 11.** Type `20270101` in **First cycle starts**, leaving **Each cycle lasts** at **3**, **Months**, and **Names** at **{YY}.{N}**.
  - **Expected:**
    - Under **First cycles**, the first row reads **27.1**, **2027-01-01 to 2027-03-31**.
    - The second row reads **27.2**, **2027-04-01 to 2027-06-30**.
    - The third row reads **27.3**, **2027-07-01 to 2027-09-30**.
  - **Notes:**

- [ ] **Step 12.** Select **Set up cycles**.
  - **Expected:** A notification says **Drafted the cycles.**
  - **Notes:**

- [ ] **Step 13.** Run Publish.
  - **Expected:** Under **Cycle schedule**, a row reads **From 2027-01-01**, then **Every 3 months, named {YY}.{N}**.
  - **Notes:**

- [ ] **Step 14.** Choose **Product Manager** in the role menu.
  - **Expected:**
    - The page stays on **Releases**, with **Fictional Mainline** open.
    - **New release…** shows under **Releases**.
  - **Notes:**

- [ ] **Step 15.** Select **New release…**.
  - **Expected:** A dialog titled **New release in Fictional Mainline** opens.
  - **Notes:**

- [ ] **Step 16.** Type `Fictional Mainline 1` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 17.** Choose **27.1 (2027-01-01 to 2027-03-31)** as the first cycle.
  - **Expected:** **First cycle** shows the cycle chosen.
  - **Notes:**

- [ ] **Step 18.** Choose **27.2 (2027-04-01 to 2027-06-30)** as the last cycle.
  - **Expected:** **Last cycle** shows the cycle chosen.
  - **Notes:**

- [ ] **Step 19.** Type `20270615` in **Ships on**.
  - **Expected:** Under **Ships on**, the dialog reads **Ships 15 days before 27.2 ends**.
  - **Notes:**

- [ ] **Step 20.** Select **Make release**.
  - **Expected:** A notification says **Drafted the new release.**
  - **Notes:**

- [ ] **Step 21.** Run Publish.
  - **Expected:**
    - Under **Releases**, a row reads **Fictional Mainline 1**, with a yellow dot in its slot.
    - The row then reads **27.1 to 27.2 · ships 2027-06-15**, followed in bold by **15 days before 27.2 ends**.
  - **Notes:**

#### ACC-51: A Product Manager Starts the Plan

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-50.

**Preconditions:** ACC-48 done. Signed in with this account.

- [ ] **Step 1.** Select the **Projects** page in the left-hand menu.
  - **Expected:**
    - The **Projects** tab is chosen.
    - The table has only its empty row.
    - The count above it reads **0 projects**.
  - **Notes:**

- [ ] **Step 2.** Select the **Customers** tab.
  - **Expected:** The **Customers** tab is selected.
  - **Notes:**

- [ ] **Step 3.** Select the **Name** cell of the empty row, type `Fictional Lighthouse Trust`, and press Enter.
  - **Expected:**
    - A row **Fictional Lighthouse Trust** is added, with a hollow yellow dot in its slot.
    - A new empty row is under it.
  - **Notes:**

- [ ] **Step 4.** Select the **Proposals** tab.
  - **Expected:** The **Proposals** tab is selected.
  - **Notes:**

- [ ] **Step 5.** Select **New proposal**.
  - **Expected:** The side panel opens, headed **New proposal**.
  - **Notes:**

- [ ] **Step 6.** Type `Fictional Lighthouse Bid` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 7.** Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before **Fictional Lighthouse Bid**.
    - **Status** reads **Open**.
  - **Notes:**

- [ ] **Step 8.** Select the **Projects** tab.
  - **Expected:** The **Projects** tab is selected.
  - **Notes:**

- [ ] **Step 9.** Select **New project**.
  - **Expected:** The side panel opens, headed **New project**.
  - **Notes:**

- [ ] **Step 10.** Type `Fictional Lamp Room` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 11.** Type `FLR-1` in **Project ID**.
  - **Expected:** **Project ID** shows what was typed.
  - **Notes:**

- [ ] **Step 12.** Select the pencil button in the **Owner** row, and pick **Ada Quill**.
  - **Expected:** **Owner** shows **Ada Quill**.
  - **Notes:**

- [ ] **Step 13.** Select the pencil button in the **Customers** row, and pick **Fictional Lighthouse Trust**.
  - **Expected:** **Customers** shows **Fictional Lighthouse Trust**.
  - **Notes:**

- [ ] **Step 14.** Select the pencil button in the **Proposals** row, and pick **Fictional Lighthouse Bid**.
  - **Expected:** **Proposals** shows **Fictional Lighthouse Bid**.
  - **Notes:**

- [ ] **Step 15.** Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before **Fictional Lamp Room**.
    - Under **Milestones**, it reads **No milestones yet**.
  - **Notes:**

- [ ] **Step 16.** Select the **Features** page in the left-hand menu.
  - **Expected:**
    - The table has no group headings.
    - The table has only its empty row.
    - The count above it reads **0 features**.
  - **Notes:**

- [ ] **Step 17.** Select **New feature**.
  - **Expected:** The **New feature** panel opens beside the table.
  - **Notes:**

- [ ] **Step 18.** Type `Fictional Tide Tables` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 19.** Select the pencil button in the **Status** row, and choose **Planned**.
  - **Expected:** **Status** shows **Planned**.
  - **Notes:**

- [ ] **Step 20.** Select the pencil button in the **Customers** row, and choose **Fictional Lighthouse Trust**.
  - **Expected:** **Customers** shows **Fictional Lighthouse Trust**.
  - **Notes:**

- [ ] **Step 21.** Select **Add**.
  - **Expected:**
    - The feature's details are headed with a hollow yellow dot before **Fictional Tide Tables**.
    - In the table, its **Feature team** cell shows a red **No team** box.
  - **Notes:**

- [ ] **Step 22.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

#### ACC-52: A Project Manager Approves the Plan and the Release Together

**Account:** Project Manager, `project.manager@fathom.test`, changed from ACC-51.

**Preconditions:** ACC-50 and ACC-51 done. Signed in with this account.

- [ ] **Step 1.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** Seven entries are shown, each with a checkbox, one each for:
    - the release stream **Fictional Mainline**
    - its cycles from **2027-01-01**
    - the release **Fictional Mainline 1**
    - the customer **Fictional Lighthouse Trust**
    - the proposal **Fictional Lighthouse Bid**
    - the project **Fictional Lamp Room**
    - the feature **Fictional Tide Tables**
  - **Notes:**

- [ ] **Step 2.** Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 7 drafts**.
  - **Notes:**

- [ ] **Step 3.** Select **Approve 7 drafts**.
  - **Expected:** A dialog titled **Approve 7 drafts?** opens.
  - **Notes:**

- [ ] **Step 4.** Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads **Approved 7 drafts.**
    - The page says **No drafts waiting for approval.**
  - **Notes:**

- [ ] **Step 5.** Select **Releases**.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] **Step 6.** Select **Fictional Mainline** in the streams table.
  - **Expected:**
    - No row in the side panel has a dot.
    - **Fictional Mainline 1** still ships on **2027-06-15**, **15 days before 27.2 ends**.
  - **Notes:**

#### ACC-53: Feature Teams Are Recorded From Six Months Ago

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-52. Step 33 signs in as another account.

**Preconditions:** ACC-48 done. Signed in with this account.

- [ ] **Step 1.** Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The page is headed **Feature assignments**.
  - **Notes:**

- [ ] **Step 2.** Select **Feature team** in the Group by menu.
  - **Expected:**
    - Every person is listed under **No feature team**.
    - No cell in any month holds a label.
  - **Notes:**

- [ ] **Step 3.** Select the **Org chart** page in the left-hand menu.
  - **Expected:**
    - The chart opens.
    - The **Date** box shows today.
  - **Notes:**

- [ ] **Step 4.** Choose **Feature teams** in the teams switch.
  - **Expected:** **Feature teams** is chosen in the teams switch.
  - **Notes:**

- [ ] **Step 5.** Clear the **Date** box, type the first day of six months ago, such as `20260501`, and press Enter.
  - **Expected:** Below the date row, text reads **Showing** and that day, such as **Showing May 1, 2026.**, then **Changes take effect from this date.**
  - **Notes:**

- [ ] **Step 6.** Select the Feature teams button.
  - **Expected:**
    - The menu reads **No feature teams yet**.
    - Under it is **New feature team**.
  - **Notes:**

- [ ] **Step 7.** Select **New feature team**.
  - **Expected:**
    - A panel titled **New feature team** opens.
    - A **Details** section has a **Name** row with an empty box.
    - A **Members** section has the rows **Feature lead** and **Members**, each with a change button.
    - **Cancel** and **Add** are at the foot.
  - **Notes:**

- [ ] **Step 8.** Type `Tide team` in the **Name** box.
  - **Expected:** The **Name** box holds **Tide team**.
  - **Notes:**

- [ ] **Step 9.** Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] **Step 10.** Type `Ada`, and press Enter.
  - **Expected:** **Ada Quill** has a tick.
  - **Notes:**

- [ ] **Step 11.** Type `Bram`, and press Enter.
  - **Expected:** **Bram Oakes** has a tick.
  - **Notes:**

- [ ] **Step 12.** Type `Cleo`, and press Enter.
  - **Expected:** **Cleo Marsh** has a tick.
  - **Notes:**

- [ ] **Step 13.** Press Enter.
  - **Expected:** **Members** lists **Ada Quill**, **Bram Oakes** and **Cleo Marsh**, one to a line.
  - **Notes:**

- [ ] **Step 14.** Select **Add**.
  - **Expected:**
    - The panel is titled **Tide team**, with a hollow yellow dot before it.
    - **Members** lists **Ada Quill**, **Bram Oakes** and **Cleo Marsh**, each with a hollow yellow dot before the name.
    - No date is after any of the names.
    - On the chart, a card named **Tide team** reads **No feature lead**.
  - **Notes:**

- [ ] **Step 15.** Select the Feature teams button, then **New feature team**.
  - **Expected:** A panel titled **New feature team** opens.
  - **Notes:**

- [ ] **Step 16.** Type `Harbour team` in the **Name** box.
  - **Expected:** The **Name** box holds **Harbour team**.
  - **Notes:**

- [ ] **Step 17.** Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] **Step 18.** Type `Dara`, and press Enter.
  - **Expected:** **Dara Finch** has a tick.
  - **Notes:**

- [ ] **Step 19.** Type `Emil`, and press Enter.
  - **Expected:** **Emil Stone** has a tick.
  - **Notes:**

- [ ] **Step 20.** Press Enter.
  - **Expected:** **Members** lists **Dara Finch** and **Emil Stone**, one to a line.
  - **Notes:**

- [ ] **Step 21.** Select the change button in the **Feature lead** row, type `Dara`, and press Enter.
  - **Expected:** **Feature lead** reads **Dara Finch**.
  - **Notes:**

- [ ] **Step 22.** Select **Add**.
  - **Expected:**
    - The panel is titled **Harbour team**, with a hollow yellow dot before it.
    - **Feature lead** reads **Dara Finch**.
    - **Members** lists **Dara Finch** and **Emil Stone**.
  - **Notes:**

- [ ] **Step 23.** Select the Feature teams button, then **New feature team**.
  - **Expected:** A panel titled **New feature team** opens.
  - **Notes:**

- [ ] **Step 24.** Type `Beacon team` in the **Name** box.
  - **Expected:** The **Name** box holds **Beacon team**.
  - **Notes:**

- [ ] **Step 25.** Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] **Step 26.** Type `Cleo`.
  - **Expected:** **Cleo Marsh** is listed.
  - **Notes:**

- [ ] **Step 27.** Press Enter.
  - **Expected:** **Cleo Marsh** has a tick.
  - **Notes:**

- [ ] **Step 28.** Type `Freya`, and press Enter.
  - **Expected:** **Freya Holt** has a tick.
  - **Notes:**

- [ ] **Step 29.** Press Enter.
  - **Expected:** **Members** lists **Cleo Marsh** and **Freya Holt**, one to a line.
  - **Notes:**

- [ ] **Step 30.** Select **Add**.
  - **Expected:**
    - The panel is titled **Beacon team**, with a hollow yellow dot before it.
    - On the chart, a card for **Cleo Marsh** is under **Tide team**.
    - Another card for **Cleo Marsh** is under **Beacon team**.
  - **Notes:**

- [ ] **Step 31.** Select **Today**.
  - **Expected:**
    - The text below the row is gone.
    - **Tide team** has **Ada Quill**, **Bram Oakes** and **Cleo Marsh** under its card.
    - **Harbour team**'s first card is Dara Finch's, with **Emil Stone** under it.
    - **Beacon team** has **Cleo Marsh** and **Freya Holt** under its card.
  - **Notes:**

- [ ] **Step 32.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 33.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 34.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 35.** Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 3 drafts**.
  - **Notes:**

- [ ] **Step 36.** Select **Approve 3 drafts**.
  - **Expected:** A dialog titled **Approve 3 drafts?** opens.
  - **Notes:**

- [ ] **Step 37.** Select **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 3 drafts.**
  - **Notes:**

#### ACC-54: The Feature Lead, Acting as Engineering Manager, Plans Team Changes Months Ahead

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-53. Step 20 signs in as another account.

**Preconditions:** ACC-53 done. Signed in with this account, acting as **Engineering Manager**. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] **Step 1.** Select the right arrow once.
  - **Expected:** Text below the row reads **Showing** with the first day of next month, such as **Showing Dec 1, 2026.**, then **Changes take effect from this date.**
  - **Notes:**

- [ ] **Step 2.** Select the Feature teams button, then **Tide team**.
  - **Expected:** The team panel is titled **Tide team**.
  - **Notes:**

- [ ] **Step 3.** Select the change button in the **Feature lead** row, type `Ada`, and press Enter.
  - **Expected:**
    - **Feature lead** reads **Ada Quill**, with a hollow yellow dot before it.
    - Under it, a green dot before **None**, in grey.
  - **Notes:**

- [ ] **Step 4.** Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] **Step 5.** Type `Bram`, and press Enter to untick **Bram Oakes**.
  - **Expected:** **Bram Oakes** has no tick.
  - **Notes:**

- [ ] **Step 6.** Press Enter.
  - **Expected:**
    - **Members** lists **Ada Quill**, **Bram Oakes** and **Cleo Marsh**.
    - A hollow yellow dot is before **Bram Oakes**.
    - **Bram Oakes** is struck through.
  - **Notes:**

- [ ] **Step 7.** Select the Feature teams button, then **Harbour team**.
  - **Expected:** The team panel is titled **Harbour team**.
  - **Notes:**

- [ ] **Step 8.** Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] **Step 9.** Type `Bram`, and press Enter.
  - **Expected:** **Bram Oakes** has a tick.
  - **Notes:**

- [ ] **Step 10.** Press Enter.
  - **Expected:**
    - **Members** lists **Bram Oakes**.
    - A hollow yellow dot is before his name.
  - **Notes:**

- [ ] **Step 11.** Select the right arrow twice.
  - **Expected:** Text below the row reads **Showing** with the first day of the month three months from now, such as **Showing Feb 1, 2027.**
  - **Notes:**

- [ ] **Step 12.** Select the Feature teams button, then **Beacon team**.
  - **Expected:** The team panel is titled **Beacon team**.
  - **Notes:**

- [ ] **Step 13.** Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] **Step 14.** Type `Cleo`, and press Enter to untick **Cleo Marsh**.
  - **Expected:** **Cleo Marsh** has no tick.
  - **Notes:**

- [ ] **Step 15.** Type `Freya`, and press Enter to untick **Freya Holt**.
  - **Expected:** **Freya Holt** has no tick.
  - **Notes:**

- [ ] **Step 16.** Press Enter.
  - **Expected:**
    - **Members** lists **Cleo Marsh** and **Freya Holt**.
    - Each has a hollow yellow dot before the name.
    - Each name is struck through.
  - **Notes:**

- [ ] **Step 17.** Select **Today**.
  - **Expected:** The text below the row is gone.
  - **Notes:**

- [ ] **Step 18.** Select the Feature teams button, then **Tide team**.
  - **Expected:**
    - In the **Members** row, **Bram Oakes** has a hollow yellow dot before his name.
    - His name is struck through.
    - It is followed in grey by **from** and the first day of next month.
  - **Notes:**

- [ ] **Step 19.** Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 20.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 21.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 22.** Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 3 drafts**.
  - **Notes:**

- [ ] **Step 23.** Select **Approve 3 drafts**.
  - **Expected:** A dialog titled **Approve 3 drafts?** opens.
  - **Notes:**

- [ ] **Step 24.** Select **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 3 drafts.**
  - **Notes:**

#### ACC-55: The Org Chart Shows Each Team Month by Month

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-54.

**Preconditions:** ACC-54 done. Signed in with this account. **Org chart** page open, with **Feature teams** chosen in the teams switch, showing today.

- [ ] **Step 1.** Read the chart.
  - **Expected:**
    - A card named **Tide team** reads **No feature lead**, with **Ada Quill**, **Bram Oakes** and **Cleo Marsh** under it.
    - **Dara Finch**'s card is named **Harbour team**, with **Emil Stone** under it.
    - A card named **Beacon team** reads **No feature lead**, with **Cleo Marsh** and **Freya Holt** under it.
  - **Notes:**

- [ ] **Step 2.** Clear the date box, type the first day of six months ago, such as `20260501`, and press Enter.
  - **Expected:**
    - Below the row, text reads **Showing** and that day, such as **Showing May 1, 2026.**, then **Changes take effect from this date.**
    - A card named **Tide team** reads **No feature lead**, with **Ada Quill**, **Bram Oakes** and **Cleo Marsh** under it.
    - **Dara Finch**'s card is named **Harbour team**, with **Emil Stone** under it.
    - A card named **Beacon team** reads **No feature lead**, with **Cleo Marsh** and **Freya Holt** under it.
  - **Notes:**

- [ ] **Step 3.** Select **Today**.
  - **Expected:** The text below the row is gone.
  - **Notes:**

- [ ] **Step 4.** Select the right arrow once.
  - **Expected:**
    - The date box shows the first day of next month.
    - **Ada Quill**'s card is named **Tide team**, with **Cleo Marsh** under it.
    - **Bram Oakes** and **Emil Stone** are under **Harbour team**.
    - A card named **Beacon team** reads **No feature lead**, with **Cleo Marsh** and **Freya Holt** under it.
  - **Notes:**

- [ ] **Step 5.** Select the right arrow twice.
  - **Expected:**
    - The date box shows the first day of three months from now.
    - Only **Tide team** and **Harbour team** are drawn.
    - No card names **Beacon team**.
  - **Notes:**

- [ ] **Step 6.** Select **Today**.
  - **Expected:**
    - The text below the row goes.
    - A card named **Tide team** reads **No feature lead**, with **Ada Quill**, **Bram Oakes** and **Cleo Marsh** under it.
    - **Dara Finch**'s card is named **Harbour team**, with **Emil Stone** under it.
    - A card named **Beacon team** reads **No feature lead**, with **Cleo Marsh** and **Freya Holt** under it.
  - **Notes:**

#### ACC-56: Feature Assignments Show the Changes by Month

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ACC-55.

**Preconditions:** ACC-54 done. Signed in with this account.

- [ ] **Step 1.** Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The page is headed **Feature assignments**.
  - **Notes:**

- [ ] **Step 2.** Select **Feature team** in the Group by menu.
  - **Expected:**
    - The groups are **Beacon team**, **Harbour team**, **Tide team** and **No feature team**, in that order.
    - **Odile Brandt** is under **No feature team**.
  - **Notes:**

- [ ] **Step 3.** Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens.
  - **Notes:**

- [ ] **Step 4.** Type `Bram`.
  - **Expected:** Only **Bram Oakes**'s rows are listed.
  - **Notes:**

- [ ] **Step 5.** Press Esc.
  - **Expected:**
    - **Bram Oakes** is listed under **Harbour team** and under **Tide team**.
    - In each of his rows, the current month's cell holds a **Tide team** label.
    - In each of his rows, next month's cell holds a **Harbour team** label.
  - **Notes:**

- [ ] **Step 6.** Scroll the table to the left until the column for seven months ago is in view, and read one of **Bram Oakes**'s rows from left to right.
  - **Expected:**
    - The cell for seven months ago holds no label.
    - From six months ago to the current month, each cell holds a **Tide team** label.
    - From next month on, each holds a **Harbour team** label.
  - **Notes:**

- [ ] **Step 7.** Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens, holding **Bram**.
  - **Notes:**

- [ ] **Step 8.** Replace `Bram` with `Cleo`.
  - **Expected:** Only **Cleo Marsh**'s rows are listed.
  - **Notes:**

- [ ] **Step 9.** Press Esc, and read **Cleo Marsh**'s rows from left to right.
  - **Expected:**
    - From six months ago to two months from now, **Cleo Marsh**'s cells hold a **Beacon team** label and a **Tide team** label.
    - From three months from now on, **Cleo Marsh**'s cells hold only **Tide team**.
  - **Notes:**

- [ ] **Step 10.** Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens, holding **Cleo**.
  - **Notes:**

- [ ] **Step 11.** Replace `Cleo` with `Freya`.
  - **Expected:** Only **Freya Holt**'s rows are listed.
  - **Notes:**

- [ ] **Step 12.** Press Esc, and read **Freya Holt**'s rows from left to right.
  - **Expected:**
    - **Freya Holt**'s cells hold a **Beacon team** label from six months ago to two months from now.
    - **Freya Holt**'s cells hold no label from three months from now on.
  - **Notes:**

#### ACC-57: A Feature Lead Gives the Feature Its Team and Cycle

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-56. Step 5 signs in as another account.

**Preconditions:** ACC-52 and ACC-53 done. Signed in with this account, acting as **Feature Lead**. **Features** page open.

- [ ] **Step 1.** Select the **Feature team** cell of **Fictional Tide Tables**, and press Enter.
  - **Expected:** The choices are **Beacon team**, **Harbour team** and **Tide team**.
  - **Notes:**

- [ ] **Step 2.** Choose **Tide team**, and press Enter.
  - **Expected:**
    - The cell reads **Tide team**, with a hollow yellow dot before it.
    - The **No team** box is gone.
    - The row is faintly yellow.
    - A Live row is under it.
  - **Notes:**

- [ ] **Step 3.** Select the row's **Target cycle** cell, press Enter, choose **Fictional Mainline: 27.1**, and press Enter.
  - **Expected:** The cell reads **Fictional Mainline: 27.1**, with a hollow yellow dot before it.
  - **Notes:**

- [ ] **Step 4.** Run Publish.
  - **Expected:**
    - The cell reads **Fictional Mainline: 27.1**, with a filled yellow dot before it.
    - The dot before **Tide team** is filled yellow too.
  - **Notes:**

- [ ] **Step 5.** Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Product Manager**.
  - **Notes:**

- [ ] **Step 6.** Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] **Step 7.** Open the ⋯ menu of **Fictional Tide Tables**, and select **Approve draft**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 8.** Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads **Approved 1 draft.**
    - **Fictional Tide Tables** has no dot.
    - It reads **Tide team** in **Feature team**.
    - It is under the heading **Fictional Mainline: 27.1**.
  - **Notes:**

**Afterwards:** Run Reset the Database.
