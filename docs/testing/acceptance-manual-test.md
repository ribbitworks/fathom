---
title: "Manual Test: End-to-End Acceptance"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/product/roles.md"]
last_updated: "2026-11-10"
---

# Manual Test: End-to-End Acceptance

## Scope

Verifies Fathom's common use by every persona in [Roles](../product/roles.md#roles-by-persona), in journeys that pass work from one account to the next: hiring and People, saved views, the org chart and feature teams, the plan from projects to releases, administration, and an organization setting Fathom up from an empty database, with feature teams that change over the months. Each feature is run once as it is usually used and once in a less usual way. The feature manual tests in `docs/testing/` cover each feature in depth.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- Roles as Fathom starts them: R2 puts them back before the first test case.
- A desktop web browser at least 1,440 pixels wide, on a computer whose appearance can be switched between light and dark.
- A second browser, or a private window, for signing in as a second account while the first stays signed in.
- A plain text editor, for typing lines to copy and paste into a table.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1, R2 and R3).

## Test Accounts

R2 and R3 create these accounts, with every other development account, as [Development Setup](../design/development-setup.md#development-accounts) lists. They share one password, which R2 and R3 print when they finish. Each holds the role its persona has in [Roles](../product/roles.md#roles-by-persona), as Fathom starts it.

- **Product Manager account:** `product.manager@fathom.test`, shown in Fathom as **Product Manager**. It holds the Product Manager role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Project Manager account:** `project.manager@fathom.test`, shown in Fathom as **Project Manager**. It holds the Project Manager role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Engineering Manager account:** `engineering.manager@fathom.test`, shown in Fathom as **Engineering Manager**. It holds the Engineering Manager role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Feature Lead account:** `feature.lead@fathom.test`, shown in Fathom as **Feature Lead**. It holds the Feature Lead role, its default, and the Engineering Manager role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Engineering Director account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. It holds the Engineering Director role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Executive account:** `executive@fathom.test`, shown in Fathom as **Executive**. It holds the Executive role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Team Member account:** `team.member@fathom.test`, shown in Fathom as **Team Member**. It holds the Team Member role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Administrator account:** `fathom.administrator@fathom.test`, shown in Fathom as **Fathom Administrator**. It holds the Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **New account:** `fictional.newcomer@fathom.test`, shown in Fathom as **Fictional Newcomer**. ACC-34 creates it with the Team Member role, and its password is the one ACC-34 shows, until ACC-34 changes it to `fictional password 2`. ACC-35 gives it the **Fictional Reader** role in place of Team Member.
- **Planning lead account:** `fictional.planning.lead@fathom.test`, shown in Fathom as **Fictional Planning Lead**. ACC-43 creates it with the Workforce Administrator role, its default, and the Product Manager role, and its password is the one ACC-43 shows, until ACC-47 changes it to `fictional password 3`.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at the address the terminal prints, such as `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use wherever a test case says so. Fathom keeps running. This removes the seed data and every draft of it, including drafts made during the test, then adds the seed data again. It keeps accounts, roles, and records added during the test and approved, such as a planned hire or a project. No test case here approves a draft the seed data holds, which R1 could not restore.

1. In the second terminal, run:

   ```sh
   pnpm db:reseed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

### R2: Reset the Database

Use before the first test case and in the last. This deletes every account and record in the development database, including anything added by hand, and puts every role back as Fathom starts it. Ask the owner before running it on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Start Fathom again (R0).

### R3: Start From an Empty Database

Use where a test case says so. This deletes every account and record in the development database, including anything added by hand, puts every role back as Fathom starts it, and adds back only the development accounts, with no other data. Ask the owner before running it on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed:accounts
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Start Fathom again (R0).

### P1: Publish

1. Select the Publish button in the top bar, which reads **Publish** followed by the number of changes waiting, such as **Publish 4 changes**.
2. Confirm that a notification says **Published** followed by the number of changes, and that the button is gone.

### P2: Discard Your Unpublished Changes

1. Select the **⋯** button beside the Publish button, then **Discard all…**.
2. In the dialog titled **Discard** followed by the number of changes, select **Discard**.
3. Confirm that a notice says **Discarded** followed by the number of changes, and that the Publish button is gone.

## Terms

- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance**, in the menu that opens from your name and initials at the top right of every page.
- **Role menu:** the choices under **Role** in the same menu, shown only for an account with more than one role.
- **Publish button:** the button in the top bar, beside your name, that reads **Publish** followed by a number of changes.
- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown after a record's name, in a row's first cell, or under a column's name. A hollow dot means the change is still unpublished.
- **Live row:** the light green row, marked with a green dot and **Live**, under a row with a draft, showing the record as it is now.
- **⋯ menu:** the menu that opens from the **⋯** button at the end of a row.
- **Column menu:** the menu that opens when you select a column's name in a table's header.
- **Draft menu:** the menu that opens from the **Draft** button above a table or the org chart.
- **Views menu:** the menu that opens from the last of the buttons after the search box above the People table. The button reads **Views**, or the name of the view applied.
- **Search for:** type the text in the search box above the table, so only the matching rows are shown.
- **Details button:** the small button with an arrow out of a box at the right of a row's **Name** cell, shown while the pointer is over the row.
- **Details panel:** the panel that slides out on the right of a table or the org chart, headed with a record's name, with an **×** at its top right.
- **Finder:** the box reading **Find a person or team** at the top left of the **Org chart** page.
- **Teams switch:** the two-part switch reading **Reporting teams** and **Feature teams** at the top right of the **Org chart** page.
- **Feature teams button:** the button reading **Feature teams** above the chart, at its right, once the chart shows feature teams.
- **Team panel:** the panel titled **Feature team** that opens beside the chart, with a **Team** drop-down at its top.
- **Group by menu:** the button above a table that starts **Group by:** and names the grouping in use.
- **Seeded dates:** the seed data is dated from the day it is added, as [Fictional Seed Data](../design/development-setup.md#fictional-seed-data) sets out, so its cycles and releases move with today. **Next quarter's cycle** is the Platform stream's cycle for the quarter after the one today is in. A cycle's name is the year it ends in and its number in that year, such as **27.1**. The examples after "such as" are as the seed data is when added in November 2026.
- **Dates:** the steps type dates as digits, such as `20300315`; the tables and panels show them as the browser's language writes them, such as **Mar 15, 2030**.
- **Months from today:** the steps name months by where they fall from the current month: **last month** is the one before it, a number of **months ago**, such as **six months ago**, that many months before it, and **three months from now** the third month after it. The steps type a month's first day as digits; the examples after "such as" are for a run in November 2026, such as `20260501` for the first day of six months ago.
- **Empty row:** the row at the end of a table, with blank cells, where a new record is typed or pasted.
- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**.
- **Takes effect from:** the date box under **Add member** in the team panel.

## Test Cases

Run the test cases in order, in about three hours and ten minutes: two and a half hours for Journeys 1 to 5, and 40 minutes for Journey 6. Start with R0, then R2; Journey 6 starts again from an empty database with R3. Check each step whose expected result you see, and write anything else under its notes.

### Journey 1: Hiring and People

#### ACC-01: A Planned Hire Is Added and Approved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step 4 signs in as another account.

**Preconditions:** R2 run. **Light** chosen in the Appearance menu. Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Select **New** at the top right of the page. Select the change button beside **State**, and choose **Request to hire**.
  - **Expected:** The details panel is headed **New planned hire**.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional mobile tester` in **Name** and `REQ-5001` in **ID**. Choose **SDET** in **Position** from its change button, and select **Add**.
  - **Expected:** The panel shows **Fictional mobile tester**. Its row in the table has a hollow yellow dot and a **Draft** mark, and reads **Request to hire** in **State**.
  - **Notes:**

- [ ] **Step 3.** Publish (P1).
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 4.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`. Select **Drafts** in the left-hand menu, and type `REQ-5001` in the search box.
  - **Expected:** One entry is shown, adding the planned hire **Fictional mobile tester**, with a checkbox.
  - **Notes:**

- [ ] **Step 5.** Select the entry's checkbox, then **Approve 1 draft**, then **Approve** in the dialog titled **Approve 1 draft?**.
  - **Expected:** The dialog closes, and a notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 6.** Select **People** in the left-hand menu, and search for `Fictional mobile tester`.
  - **Expected:** One hire row, with no mark, reading **REQ-5001** in **ID**, **SDET** in **Position** and **Request to hire** in **State**.
  - **Notes:**

#### ACC-02: Someone Who Has Not Started Is Listed Only for Those Who See Restricted Details

**Account:** Project Manager, `project.manager@fathom.test`, the same as the account ACC-01 ended with. Step 2 signs in as another account.

**Preconditions:** **People** page open.

- [ ] **Step 1.** Search for `Chatura Abbott`.
  - **Expected:** No row is shown. The table has no **Start** or **End** column.
  - **Notes:**

- [ ] **Step 2.** Sign out, and sign in as the Engineering Manager, `engineering.manager@fathom.test`. Select **People** in the left-hand menu, and search for `Chatura Abbott`.
  - **Expected:** One row, for **Chatura Abbott**, whose **Start** cell holds a date after today.
  - **Notes:**

- [ ] **Step 3.** Select the row's details button.
  - **Expected:** The details panel is headed **Chatura Abbott**, and **Start** under **Details** shows the same date.
  - **Notes:**

#### ACC-03: A Planned Hire Is Filled With a New Person

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-02. Step 5 signs in as another account.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] **Step 1.** Search for `Backend engineer 2`, and select the **Fill** button at the right of the row's **Name** cell.
  - **Expected:** The details panel is headed **Backend engineer 2**. Under **Fill this planned hire**, **New person** is selected, with the fields **Name**, **ID**, **Position**, **Start** and **Manager**. **Position** reads **Software Engineer**.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional new starter` in **Name** and `EMP-9001` in **ID**, and select **Fill** at the foot of the panel.
  - **Expected:** The panel is headed **Fictional new starter**, with a hollow yellow dot and **Draft**. The **Backend engineer 2** row has no **Fill** button, and has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 3.** Select the details button of the **Backend engineer 2** row.
  - **Expected:** The panel is headed **Backend engineer 2**, with a **Filled by** section reading **Fictional new starter** in **Name** and **EMP-9001** in **ID**.
  - **Notes:**

- [ ] **Step 4.** Publish (P1).
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 5.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`. Select **Drafts**, type `Backend engineer 2` in the search box, select the entry's checkbox, then **Approve 1 draft**.
  - **Expected:** The dialog reads **Also approves the drafts these depend on:** and names **Fictional new starter**.
  - **Notes:**

- [ ] **Step 6.** Select **Approve** in the dialog. Select **People**, and search for `Fictional new starter`.
  - **Expected:** A notice says the drafts were approved. One row, with no mark, reading **Software Engineer** in **Position** and a name in **Manager**.
  - **Notes:**

- [ ] **Step 7.** Search for `Backend engineer 2`.
  - **Expected:** No row named **Backend engineer 2** is shown.
  - **Notes:**

#### ACC-04: Filling a Planned Manager Moves the Planned Hires Under It

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-03.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] **Step 1.** Search for `Engineering Manager TBD`. Select the row's **State** cell, press Enter, choose **Approved to hire**, and press Enter.
  - **Expected:** A **Fill** button shows in the row's **Name** cell.
  - **Notes:**

- [ ] **Step 2.** Select **Fill**.
  - **Expected:** A **Direct reports** row names the planned hires that report to this one, **Platform engineer** among them.
  - **Notes:**

- [ ] **Step 3.** Type `Fictional new lead` in **Name** and `EMP-9002` in **ID**, select the change button beside **Grade**, choose **P1**, and select **Fill** at the foot of the panel.
  - **Expected:** The form closes, and the panel is headed **Fictional new lead**.
  - **Notes:**

- [ ] **Step 4.** Search for `Platform engineer TBD`.
  - **Expected:** The **Manager** cell of **Platform engineer** reads **Fictional new lead**, and the row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 5.** Discard your unpublished changes (P2), and search for `Platform engineer TBD` again.
  - **Expected:** The **Manager** cell of **Platform engineer** reads **Engineering Manager, TBD-** and a number, and the row has no mark.
  - **Notes:**

#### ACC-05: A New Manager Moves Someone to Their Team

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ACC-04. Step 4 signs in as another account.

**Preconditions:** **People** page open, with no filters.

- [ ] **Step 1.** Search for `Samuel Richter`, whose **Manager** cell reads **Atmananda Ganaka** and **Team** cell **Payments team**. Select the row's **Manager** cell, press Enter, type `Max`, and choose **Max Munk**.
  - **Expected:** The **Manager** cell reads **Max Munk** and the **Team** cell **Mobile team**, both yellow. The **Manager since** cell holds today's date. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Select the row's details button, and read the **Reporting** section.
  - **Expected:** **Manager** reads **Max Munk**, followed by a yellow dot and **Draft**, with **Atmananda Ganaka** under it, in grey, followed by a green dot and **Live**.
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu, read the panel and the row, then choose **Light**.
  - **Expected:** In dark mode, every value, mark and change button in the panel, and the yellow cells in the row, are easy to read.
  - **Notes:**

- [ ] **Step 4.** Publish (P1). Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`. Select **Drafts**, type `Samuel Richter` in the search box, select the entry's checkbox, then **Approve 1 draft**, then **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 5.** Select **People**, and search for `Samuel Richter`.
  - **Expected:** The row has no mark, and reads **Max Munk** in **Manager** and **Mobile team** in **Team**.
  - **Notes:**

#### ACC-06: A Number Column Is Added, Approved and Filled In

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-05. Step 3 signs in as another account, and step 5 signs in with this account again.

**Preconditions:** Signed in with this account. **People** page open, with no filters.

- [ ] **Step 1.** Select **New column**. Choose **Number** in **Type**.
  - **Expected:** **List** and **Several choices** are gone, and **Visible to** is shown.
  - **Notes:**

- [ ] **Step 2.** Type `On-call weeks` in **Name**, leave **General** chosen, and select **Add column**.
  - **Expected:** The dialog closes. An **On-call weeks** column with empty cells is at the right end of the table, with a hollow yellow dot and **Draft: added** under its name.
  - **Notes:**

- [ ] **Step 3.** Publish (P1). Sign out, and sign in as the Project Manager, `project.manager@fathom.test`. Select **Drafts**, and type `On-call` in the search box.
  - **Expected:** One entry is shown, for the column **On-call weeks**, with a checkbox.
  - **Notes:**

- [ ] **Step 4.** Select the entry's checkbox, then **Approve 1 draft**, then **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 5.** Sign out, and sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`. Open **People**, search for `Max Munk`, select the row's **On-call weeks** cell, type `4`, and press Enter. Search for `Lilian Lang`, and type `2.5` in her **On-call weeks** cell the same way.
  - **Expected:** **On-call weeks** has no mark under its name. The cells read **4** and **2.5**, each yellow, and each row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 6.** Clear the search. Select the **On-call weeks** header, then **Highest first**.
  - **Expected:** Max Munk's row comes before Lilian Lang's, and both come before the rows with no number.
  - **Notes:**

#### ACC-07: Metrics Count People by Two Columns and Follow a Filter

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ACC-06.

**Preconditions:** **People** page open, with no filters and no search.

- [ ] **Step 1.** Select **Metrics** above the table. Set **Break down by** to **Position**, then **and by** to **Site**.
  - **Expected:** The Metrics panel opens on the right, and the table narrows beside it. A table headed **Position by Site** has a column for each site, an **Empty** column for the planned hires, which have no site, and an **All** column, and a row for each position and an **All** row.
  - **Notes:**

- [ ] **Step 2.** Open the **Site** column menu, select **Filter…**, pick only **Ashgrove**, and press Esc.
  - **Expected:** The bar above the table says how many rows are shown of how many, such as **47 of 158**. The count line under the panel's title counts the same number of people. The **Position by Site** table has only the **Ashgrove** column besides **All**.
  - **Notes:**

- [ ] **Step 3.** Select **Clear all** in the bar above the table.
  - **Expected:** The filter is cleared, and the panel stays open.
  - **Notes:**

#### ACC-08: Metrics Show Live Figures Beside Drafts

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ACC-07.

**Preconditions:** **People** page open, with the Metrics panel open.

- [ ] **Step 1.** Open the Draft menu, select **Drafts beside live**, and press Esc. Set **Break down by** to **Grade**, and **and by** to **Nothing more**.
  - **Expected:** At least one row, such as **P1**, shows a count with a dimmed **Live** figure under it. Rows whose count the drafts do not change show no **Live** figure.
  - **Notes:**

- [ ] **Step 2.** Press Esc.
  - **Expected:** The panel closes, and the **Metrics** button has the keyboard focus.
  - **Notes:**

**Afterwards:** R1.

### Journey 2: Saved Views

#### ACC-09: A Personal View Keeps Frozen Columns, Widths and Column Order

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ACC-08.

**Preconditions:** R1 run after ACC-08. Signed in with this account. **Light** chosen in the Appearance menu. **People** page open, with no view applied.

- [ ] **Step 1.** Open the **ID** column menu, and select **Freeze up to this column**. Scroll the table sideways to the right.
  - **Expected:** **Name** and **ID** stay in place, with a thin grey line and a soft shadow at the right of **ID**, and the other columns pass under them.
  - **Notes:**

- [ ] **Step 2.** Scroll back to the left. Drag the right edge of the **Name** column's name to the right by about the width of the column.
  - **Expected:** A short blue line shows on the edge, and **Name** widens with the pointer.
  - **Notes:**

- [ ] **Step 3.** Select **Position** in the header, then **Move right**.
  - **Expected:** **Position** moves one place to the right. No mark shows under its name, and no Publish button is in the top bar.
  - **Notes:**

- [ ] **Step 4.** Open the Views menu, and select **Save view…**.
  - **Expected:** A dialog titled **Save view** shows **Name** and, under **Includes**, **Frozen** up to **ID**, **Column order** **Moved**, and **Widths** **Name**. It offers no choice about sharing.
  - **Notes:**

- [ ] **Step 5.** Type `Fictional layout` in **Name**, and select **Save view**.
  - **Expected:** The dialog closes, and the Views button reads **Fictional layout**.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu, and select **Clear view**.
  - **Expected:** Only **Name** stays in place when the table scrolls sideways, **Position** is back in its place, and **Name** is back to its width.
  - **Notes:**

- [ ] **Step 7.** Open the Views menu, and select **Fictional layout** under **My views**.
  - **Expected:** **Name** and **ID** are frozen again, **Name** is wide again, and **Position** is one place to the right again.
  - **Notes:**

- [ ] **Step 8.** Open the Views menu, and select **Delete view**.
  - **Expected:** A notice reads **Deleted the Fictional layout view.**, with **Undo**.
  - **Notes:**

#### ACC-10: A Shared View Is Seen by Others Until It Is Taken Back

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, in the main browser, changed from ACC-09. The second browser signs in as another account in step 4.

**Preconditions:** Signed in with this account in the main browser. **People** page open, with no view applied.

- [ ] **Step 1.** Search for `el`. Open the Views menu, and select **Save view…**.
  - **Expected:** The dialog shows a checkbox, **Share with everyone who sees this table**, not ticked, below **Name**.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional hiring` in **Name**, tick **Share with everyone who sees this table**, and select **Save view**.
  - **Expected:** The dialog closes, and the Views button reads **Fictional hiring**.
  - **Notes:**

- [ ] **Step 3.** Open the Views menu.
  - **Expected:** The heading **Shared views** is above **Fictional hiring**. **Take back current view** is offered.
  - **Notes:**

- [ ] **Step 4.** In the second browser, sign in as the Engineering Manager, `engineering.manager@fathom.test`, open **People**, and open the Views menu.
  - **Expected:** **Shared views** lists **Fictional hiring**.
  - **Notes:**

- [ ] **Step 5.** In the second browser, select **Fictional hiring**, then open the Views menu again.
  - **Expected:** The search box shows **el**. **Rename…**, **Delete view** and **Take back current view** are not offered.
  - **Notes:**

- [ ] **Step 6.** In the main browser, press Esc, open the Views menu, and select **Take back current view**.
  - **Expected:** A notice says **Took back the Fictional hiring view.** and offers **Undo**. In the Views menu, **Fictional hiring** is under **My views**.
  - **Notes:**

- [ ] **Step 7.** In the second browser, reload the page, and open the Views menu.
  - **Expected:** **Fictional hiring** is not listed.
  - **Notes:**

- [ ] **Step 8.** In the main browser, select **Fictional hiring** in the Views menu, then **Delete view** from the Views menu.
  - **Expected:** **Fictional hiring** is gone from the Views menu.
  - **Notes:**

### Journey 3: Org Chart and Feature Teams

#### ACC-11: A Team Member Reads the Org Chart

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-10.

**Preconditions:** Signed in with this account, in the main browser. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select **Org chart** in the **People** section of the left-hand menu, and select the name on the card for **Lorenza Thiel**.
  - **Expected:** The chart shows each person's name, position, and the team they lead. The card opens nothing, and the page stays on the chart.
  - **Notes:**

- [ ] **Step 2.** Select the **Show only this team** button at the top right of the card for **Lorenza Thiel**.
  - **Expected:** **Lorenza Thiel** is at the top of the chart, with her reports under her. To the right of the heading, the page reads **You're seeing only the team of Lorenza Thiel.**, with **Show everyone** beside it.
  - **Notes:**

- [ ] **Step 3.** Select **Show everyone**. In the finder, type `Gloria`, and select **Gloria Armas Guardado**.
  - **Expected:** The chart moves until the card for **Gloria Armas Guardado** is in the middle of the panel, with a blue ring around it.
  - **Notes:**

- [ ] **Step 4.** Choose **Feature teams** in the teams switch.
  - **Expected:** The chart shows four feature teams side by side, each first card naming its team: **Mobile apps**, **Payments core**, **Search** and **Platform reliability**. Above the chart are a left arrow, a timeline, a right arrow and a greyed-out **Today**, with no **Date** box.
  - **Notes:**

- [ ] **Step 5.** Select the left arrow once.
  - **Expected:** Text below the row reads **Showing** with last month and its year, such as **Showing Oct 2026.**, then **Nothing can be changed on this date.** No day of the month is shown.
  - **Notes:**

- [ ] **Step 6.** Select **Today**, then choose **Reporting teams** in the teams switch.
  - **Expected:** The text below the row goes, and the chart shows managers' teams again.
  - **Notes:**

#### ACC-12: An Engineering Manager Reads a Note Beside the Chart and Colours a Team

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ACC-11.

**Preconditions:** Signed in with this account. **Light** chosen in the Appearance menu. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** On the card at the top of the chart, select the name **Silje Holm-Schrøder**.
  - **Expected:** The details panel slides out on the right, headed **Silje Holm-Schrøder**, with the link **Show in People** under her position. The chart narrows, and her card, with a blue ring, stays in the middle of the space left.
  - **Notes:**

- [ ] **Step 2.** Select **Tanushree Patel-Singh** under **Direct reports**, and read **Onboarding** under **Columns**.
  - **Expected:** The panel shows **Tanushree Patel-Singh**. **Onboarding** shows the heading **First weeks**, then a checklist of four steps with only **Laptop and accounts ready** ticked and the buddy's name **Elly Gunther** in bold, then **On track** in teal, then a line ending with the link **onboarding guide**.
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu, read the panel, then choose **Light**.
  - **Expected:** In dark mode, every label, value, link and checkbox in the panel is easy to read.
  - **Notes:**

- [ ] **Step 4.** Select the **×** at the top right of the panel. On the card for **Silje Holm-Schrøder**, select the small teal dot before **Platform team**.
  - **Expected:** The panel slides away. A menu opens headed **Colour of Platform team**, listing ten colours and **No colour**, with a tick beside **Teal**.
  - **Notes:**

- [ ] **Step 5.** Select **Grape**.
  - **Expected:** The dot before **Platform team**, the bands of the cards under her and the lines to them turn grape (purple). A notification reads **Platform team is now drawn in Grape.**, with **Undo**. The Publish button does not appear.
  - **Notes:**

- [ ] **Step 6.** Select **Undo**.
  - **Expected:** The dot, the bands and the lines are teal again.
  - **Notes:**

#### ACC-13: A Person Drafted to Another Manager Is Drawn in Both Places

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ACC-12.

**Preconditions:** **Org chart** page open, showing the top two levels. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Read the card for **Simone Jean**, under **Silje Holm-Schrøder**.
  - **Expected:** The card is tinted blue. A yellow dot and **Draft** follow the name.
  - **Notes:**

- [ ] **Step 2.** On the card for **Viktoria Holmberg**, select **Show 3 reports**.
  - **Expected:** **Simone Jean**, **우아현** and **西尾 亮** appear in a column under her. The card for **Simone Jean** there is faded and light green, with a dashed edge, its name in grey and followed by a green dot and **Live**, and the line to it is dashed.
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu, then **Light**.
  - **Expected:** In both modes, the tinted card and the light green card are easy to tell apart from the other cards, and every word on them is easy to read.
  - **Notes:**

#### ACC-14: A Feature Lead Proposes a Lead and a Member

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-13.

**Preconditions:** Signed in with this account, acting as **Feature Lead**. **Org chart** page open, with **Feature teams** chosen in the teams switch.

- [ ] **Step 1.** Select the Feature teams button, then **Platform reliability**.
  - **Expected:** The team panel opens with **Team** reading **Platform reliability**, **Feature lead** reading **No lead**, no **Rename** button, and no **Takes effect from** box.
  - **Notes:**

- [ ] **Step 2.** In **Feature lead**, choose **Polly Smith**.
  - **Expected:** A notice offers **Undo**. The panel shows a yellow dot and **Draft** under its title. On the chart, the team's first card is now Polly Smith's, named **Platform reliability**.
  - **Notes:**

- [ ] **Step 3.** In **Add member**, type `Rosendo`, and choose **Rosendo Champlin**.
  - **Expected:** **Rosendo Champlin** is listed among the members with a yellow dot and **Draft**. On the chart, a card for him under Polly Smith is marked as a draft, and his card in **Mobile apps** stays.
  - **Notes:**

- [ ] **Step 4.** Publish (P1).
  - **Expected:** The Publish button is gone.
  - **Notes:**

#### ACC-15: A Project Manager Approves the Feature Team

**Account:** Project Manager, `project.manager@fathom.test`, changed from ACC-14.

**Preconditions:** ACC-14 done. Signed in with this account.

- [ ] **Step 1.** Select **Drafts** in the left-hand menu, and type `Platform reliability` in the search box.
  - **Expected:** One entry, **the feature team Platform reliability**, with lines for **Feature lead** set to **Polly Smith** and **Members** with **Rosendo Champlin** added, made by **Feature Lead**.
  - **Notes:**

- [ ] **Step 2.** Select the entry's checkbox, then **Approve 1 draft**, then **Approve** in the dialog.
  - **Expected:** The dialog closes, and a notice begins **Approved**.
  - **Notes:**

- [ ] **Step 3.** Select **Org chart**, and choose **Feature teams** in the teams switch.
  - **Expected:** **Platform reliability** is led by **Polly Smith**, with **Rosendo Champlin** among the cards under her, and no draft marks.
  - **Notes:**

#### ACC-16: A Member Joins a Feature Team From an Earlier Date

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-15. Step 5 signs in as another account.

**Preconditions:** Signed in with this account. **Org chart** page open, with **Feature teams** chosen in the teams switch.

- [ ] **Step 1.** Select the Feature teams button, then **Search**. In **Add member**, type `Branson`, and choose **Branson O'Keefe**.
  - **Expected:** **Branson O'Keefe** is listed among the members with a yellow dot and **Draft**. A **Takes effect from** box under **Add member** shows today's date, such as **2026-11-09**.
  - **Notes:**

- [ ] **Step 2.** Clear **Takes effect from**, type the first day of last month as digits alone, such as `20261001`, and press Enter.
  - **Expected:** The cursor leaves the box, and a notice reads **Date changed**, with **Undo**.
  - **Notes:**

- [ ] **Step 3.** Close the panel, and open **Search** again from the Feature teams button.
  - **Expected:** **Takes effect from** shows the first day of last month.
  - **Notes:**

- [ ] **Step 4.** Publish (P1).
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 5.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`. Select **Drafts**, and type `Branson` in the search box.
  - **Expected:** One entry, **the feature team Search**, with lines for **Members** with **Branson O'Keefe** added, and **Joining and leaving dates** set to **Branson O'Keefe** and the first day of last month.
  - **Notes:**

- [ ] **Step 6.** Select the entry's checkbox, then **Approve 1 draft**, then **Approve** in the dialog.
  - **Expected:** The dialog closes, and a notice begins **Approved**.
  - **Notes:**

#### ACC-17: Feature Assignments Show the Earlier Join

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-16.

**Preconditions:** ACC-16 done. Signed in with this account. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select **Feature assignments** in the left-hand menu.
  - **Expected:** The page is headed **Feature assignments**, with **Group by: Manager** above the table. The table has a **Person** column on the left and a column for each month, starting with the current month.
  - **Notes:**

- [ ] **Step 2.** Select **Feature team** in the Group by menu.
  - **Expected:** The rows are grouped under the feature teams in order of name, then **No feature team**. Each label names a feature team, in the colour the **Org chart** gives it.
  - **Notes:**

- [ ] **Step 3.** Open the **Person** column menu, select **Filter…**, and type `Branson`.
  - **Expected:** Only **Branson O'Keefe** is listed, under the **Search** group, with a **Search** label in the current month's column.
  - **Notes:**

- [ ] **Step 4.** Press Esc, and scroll the table one month to the left.
  - **Expected:** The **Person** column stays in place. Last month's cell for **Branson O'Keefe** holds a **Search** label too, and the month before it holds none.
  - **Notes:**

- [ ] **Step 5.** Choose **Dark** in the Appearance menu, then **Light**.
  - **Expected:** In both modes, the labels, headings and group names are easy to read.
  - **Notes:**

#### ACC-18: A Team Member Groups Feature Assignments Only by Feature Team

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-17.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select **Feature assignments** in the left-hand menu.
  - **Expected:** The button reads **Group by: Feature team**.
  - **Notes:**

- [ ] **Step 2.** Open the Group by menu.
  - **Expected:** It offers **Feature team** and **None**, and no **Manager**.
  - **Notes:**

- [ ] **Step 3.** Select a cell holding a label, press Enter, then type a letter.
  - **Expected:** No box for editing opens, and nothing in the cell changes.
  - **Notes:**

**Afterwards:** R1.

### Journey 4: The Plan

#### ACC-19: A Product Manager Adds a Customer, a Proposal and a Project With Milestones

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-18.

**Preconditions:** R1 run after ACC-18. Signed in with this account. **Projects** page open from the left-hand menu.

- [ ] **Step 1.** Select the **Customers** tab, then **New customer**. Type `Fictional Ferry Co-op` in **Name**, and select **Add**.
  - **Expected:** The side panel is headed **Fictional Ferry Co-op**, with a hollow yellow dot and **Draft: added**, and the table has a row for it with the same mark.
  - **Notes:**

- [ ] **Step 2.** Select the **Proposals** tab, then **New proposal**. Type `Fictional Ferry Proposal` in **Name**, and select **Add**.
  - **Expected:** The side panel is headed **Fictional Ferry Proposal** with a hollow yellow dot and **Draft: added**, and **Status** reads **Open**.
  - **Notes:**

- [ ] **Step 3.** Select the **Projects** tab, then **New project**. Type `Fictional Harbour Lights` in **Name** and `FHL-1` in **Project ID**. Using the pencil buttons, pick any person in **Owner**, **Fictional Ferry Co-op** in **Customers** and **Fictional Ferry Proposal** in **Proposals**. Write the owner's name in the notes, and select **Add**.
  - **Expected:** The side panel is headed **Fictional Harbour Lights** with a hollow yellow dot and **Draft: added**. **First milestone**, **Last milestone** and **Next delivery** read **None**. Under **Milestones**, **No milestones yet** and an **Add milestone** button.
  - **Notes:**

- [ ] **Step 4.** Select **Add milestone**. Type `Pilot` in **Name** and `20300315` in **Date**, tick **Customer delivery**, and select **Add milestone** in the dialog.
  - **Expected:** Under **Milestones**, **Pilot** with a hollow yellow dot and **Draft: added**, and under it the date for 2030-03-15 and **, customer delivery**.
  - **Notes:**

- [ ] **Step 5.** Select **Add milestone**. Type `Go live` in **Name** and `20300630` in **Date**, leave **Customer delivery** unticked, and select **Add milestone** in the dialog.
  - **Expected:** **Go live** is listed after **Pilot**. **First milestone** shows 2030-03-15, **Last milestone** 2030-06-30, and **Next delivery** 2030-03-15. The table's row for **Fictional Harbour Lights** shows the same three dates.
  - **Notes:**

- [ ] **Step 6.** Publish (P1).
  - **Expected:** The marks on the project and both milestones are now solid yellow dots with **Draft: added**.
  - **Notes:**

#### ACC-20: A Project Manager Approves the Project and Its Milestones

**Account:** Project Manager, `project.manager@fathom.test`, changed from ACC-19.

**Preconditions:** ACC-19 done. Signed in with this account. **Projects** page open, on the **Projects** tab.

- [ ] **Step 1.** Open the ⋯ menu of **Fictional Harbour Lights**, and select **Approve draft**.
  - **Expected:** A dialog asks to approve the drafts. Under **Also approves the drafts these depend on:**, it lists **the proposal Fictional Ferry Proposal** and **the customer Fictional Ferry Co-op**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve** in the dialog.
  - **Expected:** **Fictional Harbour Lights** has no mark.
  - **Notes:**

- [ ] **Step 3.** Select the **Milestones** tab, then the Draft menu.
  - **Expected:** The menu offers **Approve** with the number of waiting drafts, such as **Approve 2 drafts…**.
  - **Notes:**

- [ ] **Step 4.** Select it, then **Approve** in the dialog.
  - **Expected:** **Pilot** and **Go live** have no marks, and each has **Fictional Harbour Lights** under **Project**.
  - **Notes:**

- [ ] **Step 5.** Choose **Dark** in the Appearance menu, look over the tabs and the table, then choose **Light**.
  - **Expected:** In dark mode, the text, the tabs and the ticked **Customer delivery** box are easy to read.
  - **Notes:**

#### ACC-21: A Product Manager Adds a Feature With a Formatted Note

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-20. Step 6 signs in as another account.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

- [ ] **Step 1.** Select **New feature**.
  - **Expected:** The **New feature** panel opens beside the table, with labels at the left of each row, under the headings **Details** and **Columns**. The **Notes** row reads **None**, with a pencil button at its right.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional Atlas` in **Name**, and select the pencil button in the **Notes** row.
  - **Expected:** A second panel opens under **New feature**, titled **Notes for New feature**, with **Note**, **Editor** and **Markdown** at its top, on **Editor**, and a toolbar under the text.
  - **Notes:**

- [ ] **Step 3.** Type `Ferry routes first`, select those words, and select **Bold** in the toolbar. Select **Save** in the note's panel.
  - **Expected:** The note's panel closes. The **Notes** row shows **Ferry routes first** in bold, and **Name** still reads **Fictional Atlas**.
  - **Notes:**

- [ ] **Step 4.** Select **Add** at the foot of the **New feature** panel.
  - **Expected:** The feature's details show beside the table, headed **Fictional Atlas** with a hollow yellow dot and **Draft: added**, with **Ferry routes first** in bold under **Notes**.
  - **Notes:**

- [ ] **Step 5.** Publish (P1), and reload the page.
  - **Expected:** **Fictional Atlas** is under the heading **Later**, with a solid yellow dot and **Draft: added**.
  - **Notes:**

- [ ] **Step 6.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`. Open **Features**, open the ⋯ menu of **Fictional Atlas**, select **Approve draft**, then **Approve** in the dialog titled **Approve 1 draft?**.
  - **Expected:** A notice reads **Approved 1 draft.** **Fictional Atlas** has no mark.
  - **Notes:**

#### ACC-22: Leaving the New Feature Panel Asks First

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-21.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select **New feature**, type `Fictional Compass` in **Name**, and select **Cancel** at the foot of the panel.
  - **Expected:** A box asks **Discard the feature you're adding?**, with **Keep adding** and **Discard**.
  - **Notes:**

- [ ] **Step 2.** Select **Keep adding**.
  - **Expected:** The box closes, and **Name** still reads **Fictional Compass**.
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**, then **Discard**.
  - **Expected:** The panel closes. No row for **Fictional Compass** is in the table, and no Publish button is in the top bar.
  - **Notes:**

#### ACC-23: A Feature Status Is Added to Its List

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-22. Step 4 signs in as another account.

**Preconditions:** Signed in with this account. **Lists** page open from the left-hand menu.

- [ ] **Step 1.** Select **Feature statuses**.
  - **Expected:** The panel opens with **Feature statuses** at the top and a grey **Built in** label beside it. Its choices are **Possible**, **Planned**, **In progress**, **Done** and **Cancelled**, each beside a meaning of the same name.
  - **Notes:**

- [ ] **Step 2.** In the empty row's meaning menu, choose **Possible**. Type `Long shot` in the empty row's **Name** box, and press Enter.
  - **Expected:** A row **Long shot** appears above the empty row, with a hollow yellow dot and **Draft: added**, and **Possible** at the end of the row.
  - **Notes:**

- [ ] **Step 3.** Publish (P1).
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 4.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`. Open **Lists**, then **Feature statuses**. Select the **⋯** button at the end of the **Long shot** row, then **Approve…**, then **Approve** in the dialog titled **Approve 1 draft?**.
  - **Expected:** The dialog closes, and **Long shot** has no mark.
  - **Notes:**

#### ACC-24: The Last Status for a Meaning Is Kept

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-23.

**Preconditions:** Signed in with this account. **Lists** page open, with the **Feature statuses** panel open.

- [ ] **Step 1.** Select the **⋯** button at the end of the **Cancelled** row.
  - **Expected:** **Retire** and **Remove** are greyed out, with **Needed for Cancelled** under them.
  - **Notes:**

- [ ] **Step 2.** Press Esc, and select the **⋯** button at the end of the **Possible** row.
  - **Expected:** **Retire** can be selected, with no **Needed for** line under it.
  - **Notes:**

- [ ] **Step 3.** Press Esc.
  - **Expected:** The menu closes, and nothing has changed.
  - **Notes:**

#### ACC-25: A Feature Lead's Change Is Rejected With a Reason

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-24. Step 3 signs in as another account.

**Preconditions:** ACC-23 done. Signed in with this account, acting as **Feature Lead**. **Features** page open.

- [ ] **Step 1.** In the row **Voice Notes**, select the **Status** cell, press Enter, choose **Long shot**, and press Enter.
  - **Expected:** The cell reads **Long shot** and is yellow. The row has a hollow yellow dot and **Draft**, with a Live row under it reading **Possible**.
  - **Notes:**

- [ ] **Step 2.** Publish (P1).
  - **Expected:** The dot on the **Voice Notes** row is filled.
  - **Notes:**

- [ ] **Step 3.** Sign out, and sign in as the Product Manager, `product.manager@fathom.test`. Open **Features**, and open the ⋯ menu of **Voice Notes**.
  - **Expected:** The menu names the change to **Status**, and offers **Approve draft** and **Reject draft…**.
  - **Notes:**

- [ ] **Step 4.** Select **Reject draft…**.
  - **Expected:** A dialog titled **Reject 1 draft?** opens, with a **Reason** box.
  - **Notes:**

- [ ] **Step 5.** Type `Fictional reason: wait for the customer day.`, and select **Reject**.
  - **Expected:** A notice reads **Rejected 1 draft.** The **Voice Notes** row shows a red dot and **Rejected**.
  - **Notes:**

#### ACC-26: A Rejected Change Is Resubmitted and Approved

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-25. Step 3 signs in as another account.

**Preconditions:** ACC-25 done. Signed in with this account, acting as **Feature Lead**. **Features** page open.

- [ ] **Step 1.** Open the ⋯ menu of **Voice Notes**.
  - **Expected:** The menu shows a red dot and **Rejected**, and **Reason: Fictional reason: wait for the customer day.**, and offers **Resubmit** and **Discard draft**.
  - **Notes:**

- [ ] **Step 2.** Select **Resubmit**.
  - **Expected:** The row shows a yellow dot and **Draft** again.
  - **Notes:**

- [ ] **Step 3.** Sign out, and sign in as the Product Manager, `product.manager@fathom.test`. Select **Drafts**, and type `Voice Notes` in the search box.
  - **Expected:** One entry is shown, for the feature **Voice Notes**, made by **Feature Lead**, with a checkbox.
  - **Notes:**

- [ ] **Step 4.** Select the entry's checkbox, then **Approve 1 draft**, then **Approve** in the dialog titled **Approve 1 draft?**.
  - **Expected:** A notice reads **Approved 1 draft.** The page says **No drafts match the search.**
  - **Notes:**

- [ ] **Step 5.** Select **Features**.
  - **Expected:** **Voice Notes** reads **Long shot** in **Status**, with no mark.
  - **Notes:**

#### ACC-27: The Change History Tells How a Draft Went

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from ACC-26.

**Preconditions:** ACC-26 done. Signed in with this account.

- [ ] **Step 1.** Select **Change history** in the left-hand menu, and type `Voice Notes` in the search box.
  - **Expected:** The entries, newest first, say that Product Manager approved the changes to **Voice Notes**, Feature Lead sent its draft for approval again, Product Manager rejected its draft, with the reason **Fictional reason: wait for the customer day.**, and Feature Lead drafted changing **Status** from **Possible** to **Long shot**.
  - **Notes:**

- [ ] **Step 2.** Choose **Dark** in the Appearance menu, read the entries, then choose **Light**.
  - **Expected:** In both modes, the entries are easy to read.
  - **Notes:**

#### ACC-28: A Shorter Cycle Moves a Release and Its Features

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-27. Step 4 signs in as another account.

**Preconditions:** Signed in with this account. **Releases** page open from the left-hand menu, with **Platform** selected in the streams table.

- [ ] **Step 1.** In the side panel's **Cycles** table, select the **⋯** button at the end of next quarter's cycle, such as **27.1**, then **Change length…**.
  - **Expected:** A dialog titled **Change the length of** that cycle opens. **Length** reads **3**, followed by **months**. Under **Later cycles**, **Move with it** is selected.
  - **Notes:**

- [ ] **Step 2.** Replace **3** in **Length** with `2`.
  - **Expected:** **New dates** lists that cycle two months long, then the next cycles each starting a month earlier than before. **Releases that move** names **Harbor 3**, and **Features that move** names **Data Retention Controls** and **Report Builder**.
  - **Notes:**

- [ ] **Step 3.** Select **Change length**, then publish (P1).
  - **Expected:** A notification says **Drafted the new length.** The **Harbor 3** row under **Releases** has a yellow dot and **Draft**, and ships on the first half-year cycle's new last day, such as **27.1 to 27.3 · ships 2027-11-30**.
  - **Notes:**

- [ ] **Step 4.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`. Open **Releases**, select **Platform**, then the **⋯** button at the end of the **Harbor 3** row, then **Approve…**.
  - **Expected:** A dialog titled **Approve 6 drafts?** says **Also approves the drafts these depend on:**, listing three entries for **the cycles of Platform from** a day, with **the feature Data Retention Controls** and **the feature Report Builder**.
  - **Notes:**

- [ ] **Step 5.** Select **Approve**.
  - **Expected:** A notification says **Approved 6 drafts.** No row under **Cycle schedule** or **Releases** has a mark, and **Harbor 3** still ships on the new day.
  - **Notes:**

#### ACC-29: A Product Manager Makes a Release

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-28. Step 4 signs in as another account.

**Preconditions:** Signed in with this account. **Releases** page open from the left-hand menu, with **Platform** selected in the streams table.

- [ ] **Step 1.** Select **New release…** under **Releases** in the side panel.
  - **Expected:** A dialog titled **New release in Platform** opens, with **Name**, **First cycle**, **Last cycle** and an empty **Ships on**.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional Harbor 4` in **Name**, and choose the last cycle in the list as both the first and the last cycle.
  - **Expected:** Under **Ships on**, the dialog reads **Leave empty to ship at the end of its last cycle, on** that cycle's last day.
  - **Notes:**

- [ ] **Step 3.** Select **Make release**, then publish (P1).
  - **Expected:** A notification says **Drafted the new release.** Under **Releases**, a row reads **Fictional Harbor 4**, with a yellow dot and **Draft: added**.
  - **Notes:**

- [ ] **Step 4.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`. Open **Releases**, select **Platform**, then the **⋯** button at the end of the **Fictional Harbor 4** row, then **Approve…**, then **Approve** in the dialog titled **Approve 1 draft?**.
  - **Expected:** A notification says **Approved 1 draft.** **Fictional Harbor 4** has no mark.
  - **Notes:**

#### ACC-30: An Executive Reads the Plan

**Account:** Executive, `executive@fathom.test`, changed from ACC-29.

**Preconditions:** ACC-29 done. Signed in with this account. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Look at the page and the left-hand menu.
  - **Expected:** The **Overview** page is open. The menu shows **Overview**, **Projects**, **Features** and **Releases** in the **Plan** section; **People**, **Org chart**, **Feature assignments**, **Drafts**, **Capacity** tagged **Later**, and **Lists** in the **People** section; **Accounts**, **Roles** and **Settings** in the **Administration** section; **Change history** and **Access history** in the **History** section; and the **Help** section.
  - **Notes:**

- [ ] **Step 2.** Select **Releases**, then **Platform** in the streams table.
  - **Expected:** There is no **New release stream** button, no **New release…** button, and no **⋯** button at the end of any release.
  - **Notes:**

- [ ] **Step 3.** Close the side panel, scroll to the timeline, and select **All**.
  - **Expected:** The whole timeline fits across. **Fictional Harbor 4** is at the right end of **Platform**'s releases lane, with a diamond at its right end.
  - **Notes:**

- [ ] **Step 4.** Hover over **Fictional Harbor 4**'s span.
  - **Expected:** A tooltip names **Fictional Harbor 4**, its cycle and the day it ships.
  - **Notes:**

- [ ] **Step 5.** Select **Features**, then **Group by: Cycle** above the table, then **Needed by**.
  - **Expected:** Each heading names a month and year, such as **Mar 2027**, with how many features it holds, from the earliest month to the latest, and the last heading is **No date**. There is no **New feature** button.
  - **Notes:**

- [ ] **Step 6.** Select **Group by: Needed by**, then **Cycle**. Choose **Dark** in the Appearance menu, look over the table, then choose **Light**.
  - **Expected:** The headings name cycles again, with **Later** last. In dark mode, every word, the group headings and the lines between rows are easy to read.
  - **Notes:**

#### ACC-31: An Executive Sees People and Administration Without Changing Them

**Account:** Executive, `executive@fathom.test`, the same as ACC-30.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select **People**, and search for `Chatura Abbott`.
  - **Expected:** Her row is shown, with a date after today in **Start**. The table has **Start** and **End** columns. There is no **New** and no **New column** button.
  - **Notes:**

- [ ] **Step 2.** Select **Drafts**.
  - **Expected:** Drafts are listed, with no checkboxes, and no **Select all waiting** or **Approve** button.
  - **Notes:**

- [ ] **Step 3.** Select **Accounts**.
  - **Expected:** Every account is in the table with its roles. There is no **New account** button and no **Edit** button in any row.
  - **Notes:**

#### ACC-32: A Team Member Reads the Plan Without Changing It

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-31.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Look at the left-hand menu.
  - **Expected:** The menu shows **Overview**, **Projects**, **Features** and **Releases** in the **Plan** section; **Org chart**, **Feature assignments**, **Drafts** and **Capacity** tagged **Later** in the **People** section; and the **Help** section. There is no **People** page.
  - **Notes:**

- [ ] **Step 2.** Select **Features**.
  - **Expected:** The table shows **Fictional Atlas** and **Voice Notes** reading **Long shot**, with no **New feature** button and no empty row at its end.
  - **Notes:**

- [ ] **Step 3.** Double-click the **Status** cell of any row.
  - **Expected:** The cell does not open for editing.
  - **Notes:**

- [ ] **Step 4.** Select **Releases**, then **Platform** in the streams table.
  - **Expected:** **Fictional Harbor 4** is under **Releases**. No row has a **⋯** button, and there is no **New release…** button.
  - **Notes:**

#### ACC-33: Removing a Project Removes Its Milestones

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-32. Step 3 signs in as another account.

**Preconditions:** ACC-20 done. Signed in with this account. **Projects** page open, on the **Projects** tab.

- [ ] **Step 1.** Open the ⋯ menu of **Fictional Harbour Lights**, and select **Remove project**.
  - **Expected:** **Fictional Harbour Lights** is struck through, with a hollow yellow dot and **Draft: removed**.
  - **Notes:**

- [ ] **Step 2.** Publish (P1).
  - **Expected:** The mark becomes a solid yellow dot.
  - **Notes:**

- [ ] **Step 3.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`. Open **Projects**, open the ⋯ menu of **Fictional Harbour Lights**, and select **Approve draft**.
  - **Expected:** The dialog names the removal of **the project Fictional Harbour Lights** and, as drafts it includes, the removal of **Pilot** and **Go live**.
  - **Notes:**

- [ ] **Step 4.** Select **Approve** in the dialog.
  - **Expected:** **Fictional Harbour Lights** is no longer listed.
  - **Notes:**

- [ ] **Step 5.** Select the **Milestones** tab.
  - **Expected:** **Pilot** and **Go live** of **Fictional Harbour Lights** are no longer listed.
  - **Notes:**

### Journey 5: Administration

#### ACC-34: A New Account Signs In for the First Time

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, changed from ACC-33. The second browser signs in as the new account in step 4.

**Preconditions:** Signed in with this account in the main browser. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Look at the left-hand menu.
  - **Expected:** The menu shows **Accounts**, **Roles** and **Settings** in the **Administration** section, **Access history** in the **History** section, and the **Help** section. It shows no page of the plan or of people.
  - **Notes:**

- [ ] **Step 2.** Select **Accounts**, then **New account**.
  - **Expected:** A dialog titled **New account**, with an empty **Name** and **Email address**, and **Roles** listing every role, each with a square tick box and its description. Only **Team Member** is ticked.
  - **Notes:**

- [ ] **Step 3.** Type `Fictional Newcomer` in **Name** and `fictional.newcomer@fathom.test` in **Email address**, and select **Create account**. Select the eye button, write the password down, and select **Done**.
  - **Expected:** The dialog, titled **Password for Fictional Newcomer**, says **This password is shown only once. Fictional Newcomer must change it at the next sign-in.** The eye button shows the password. Once **Done** is selected, a green banner says **Created the account for Fictional Newcomer.**, and the table has a **Fictional Newcomer** row with **Team Member** in **Roles**.
  - **Notes:**

- [ ] **Step 4.** In the second browser, sign out if signed in, and sign in as the new account, `fictional.newcomer@fathom.test`, with the password written down.
  - **Expected:** A panel headed **Change password** says **Fathom generated this password. A new password is required to continue.** There is no left-hand menu.
  - **Notes:**

- [ ] **Step 5.** Enter the password written down in **Current password**, and `fictional password 2` in **New password** and **New password again**, and select **Change password**.
  - **Expected:** A green banner says **Your password has been changed, and you have been signed out everywhere else.**, and Fathom opens on the **Overview**, with the left-hand menu.
  - **Notes:**

#### ACC-35: A Copied Role Is Given to the New Account

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ACC-34. The second browser stays signed in as the new account.

**Preconditions:** ACC-34 done. **Roles** page open from the left-hand menu.

- [ ] **Step 1.** Select **Copy** in the **Team Member** row.
  - **Expected:** A dialog titled **Copy Team Member**, with the name **Copy of Team Member**, and **View** ticked on **Plan**, **Allocations** and **Org chart**. Its main button is **Create role**.
  - **Notes:**

- [ ] **Step 2.** Replace the name with `Fictional Reader`, tick **View** on **Change history**, and select **Create role**.
  - **Expected:** A green banner says **The role has been created.**, and **Fictional Reader** is in the list with 0 accounts.
  - **Notes:**

- [ ] **Step 3.** Select **Accounts**, then **Edit** in the **Fictional Newcomer** row. Tick **Fictional Reader**, untick **Team Member**, and select **Save**.
  - **Expected:** A green banner says **Saved the account for Fictional Newcomer.**, and the row's **Roles** cell shows **Fictional Reader**.
  - **Notes:**

- [ ] **Step 4.** In the second browser, reload the page.
  - **Expected:** The left-hand menu shows **Change history** in the **History** section.
  - **Notes:**

#### ACC-36: Restore Template Brings Back a Starting Role

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ACC-35.

**Preconditions:** **Roles** page open.

- [ ] **Step 1.** Select **Edit** in the **Executive** row, and tick **Edit** on the **Plan** row.
  - **Expected:** **What it is for** is empty, with a line under it reading **What the role grants changed, so its old summary is gone.** **Restore template** is turned on.
  - **Notes:**

- [ ] **Step 2.** Select **Restore template**.
  - **Expected:** **What it is for** reads **Sees the plan, people, with their Restricted and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them.**, **Edit** on **Plan** is unticked, and **Restore template** is turned off.
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:** The dialog closes, and the **Executive** row is unchanged.
  - **Notes:**

#### ACC-37: A Deactivated Account Is Signed Out, Then Reactivated

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ACC-36. The second browser stays signed in as the new account.

**Preconditions:** ACC-35 done. **Accounts** page open.

- [ ] **Step 1.** Select **Edit** in the **Fictional Newcomer** row, then **Deactivate**.
  - **Expected:** A dialog titled **Deactivate Fictional Newcomer** says **Fictional Newcomer will be signed out everywhere, and will not be able to sign in until the account is reactivated.**, with **Cancel** and a red **Deactivate**.
  - **Notes:**

- [ ] **Step 2.** Select **Deactivate**.
  - **Expected:** A green banner says **Deactivated the account for Fictional Newcomer.**, and the row says **Deactivated**, in grey.
  - **Notes:**

- [ ] **Step 3.** In the second browser, select any page in the left-hand menu.
  - **Expected:** The **Sign in** page opens.
  - **Notes:**

- [ ] **Step 4.** In the main browser, select **Deactivated 1** in the filter beside the search box, then **Edit** in the **Fictional Newcomer** row, then **Reactivate**, then **Reactivate** in the dialog.
  - **Expected:** A green banner says **Reactivated the account for Fictional Newcomer.**, and the filter reads **Deactivated 0**.
  - **Notes:**

- [ ] **Step 5.** In the second browser, sign in as the new account, `fictional.newcomer@fathom.test`, with `fictional password 2`.
  - **Expected:** Fathom opens, with **Change history** in the left-hand menu.
  - **Notes:**

#### ACC-38: The Access History Records What Was Done to the Account

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, the same as ACC-37.

**Preconditions:** ACC-34 to ACC-37 done.

- [ ] **Step 1.** Select **Access history** in the left-hand menu, and type `Fictional Newcomer` in the search box at the top of the page.
  - **Expected:** The entries include, from newest to oldest: Fathom Administrator **reactivated the account for** Fictional Newcomer; **deactivated the account for** Fictional Newcomer, marked as worth checking; **changed the role of** Fictional Newcomer, from Team Member to Fictional Reader, marked as worth checking; Fictional Newcomer **changed their own password**; and Fathom Administrator **created the account for** Fictional Newcomer.
  - **Notes:**

- [ ] **Step 2.** Choose **Dark** in the Appearance menu, read the entries, then choose **Light**.
  - **Expected:** In both modes, the entries and their marks are easy to read.
  - **Notes:**

#### ACC-39: Switching Role Changes What Can Be Done at Once

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, changed from ACC-38.

**Preconditions:** Signed in with this account, acting as **Feature Lead**. **Releases** page open, with **Platform** selected in the streams table.

- [ ] **Step 1.** Open the menu from your name and initials at the top right.
  - **Expected:** **Role** lists **Engineering Manager** and **Feature Lead**, with a tick beside **Feature Lead** only.
  - **Notes:**

- [ ] **Step 2.** Press Esc, and look under **Releases** in the side panel.
  - **Expected:** The rows have no **⋯** button, and there is no **New release…** button.
  - **Notes:**

- [ ] **Step 3.** Choose **Engineering Manager** in the role menu.
  - **Expected:** The menu closes, and the page stays on **Releases** with **Platform** open, without the browser reloading. Each row under **Releases** now ends with a **⋯** button, and **New release…** shows.
  - **Notes:**

#### ACC-40: The Change History Names the Role a Change Was Made As

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, the same as ACC-39.

**Preconditions:** ACC-39 done, acting as **Engineering Manager**. **Releases** page open, with **Platform** selected in the streams table.

- [ ] **Step 1.** Select the **⋯** button at the end of the **Harbor 3** row, then **Change…**. Replace the name with `Fictional Harbor Three`, and select **Save**.
  - **Expected:** A notification says **Drafted the change to the release.** The row reads **Fictional Harbor Three**, with a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Publish (P1), then select **Change history** in the left-hand menu.
  - **Expected:** The latest entry names **Fictional Harbor Three** and starts with **Feature Lead as Engineering Manager**.
  - **Notes:**

- [ ] **Step 3.** Select **Releases**, then **Platform**, then the **⋯** button at the end of the **Fictional Harbor Three** row, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** The row reads **Harbor 3** again, with no mark.
  - **Notes:**

- [ ] **Step 4.** Choose **Feature Lead** in the role menu.
  - **Expected:** The rows under **Releases** have no **⋯** button again.
  - **Notes:**

#### ACC-41: Each Browser Keeps Its Own Appearance

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, changed from ACC-40. Step 4 signs in again with this account.

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

- [ ] **Step 5.** Choose **System** in the Appearance menu, then set the computer's appearance to dark, then back to light.
  - **Expected:** The page turns light when **System** is chosen, turns dark with the computer, then light again.
  - **Notes:**

- [ ] **Step 6.** Choose **Light** in the Appearance menu.
  - **Expected:** The page stays light, and the tick in the menu is beside **Light**.
  - **Notes:**

#### ACC-42: Put Everything Back

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ACC-41. Step 1 signs in again with this account.

**Preconditions:** All the test cases above run.

- [ ] **Step 1.** Reset the database (R2), and sign in as the Administrator, `fathom.administrator@fathom.test`. Select **Accounts** in the left-hand menu.
  - **Expected:** The table lists the development accounts, with no **Fictional Newcomer**.
  - **Notes:**

- [ ] **Step 2.** Select **Roles** in the left-hand menu.
  - **Expected:** The roles are listed as [Roles](../product/roles.md#starting-roles) sets out, with the Superuser role, and no **Fictional Reader**.
  - **Notes:**

### Journey 6: An Organization Starts From Nothing

#### ACC-43: The Administrator Adds an Account With Two Roles

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ACC-42.

**Preconditions:** R3 run. Signed in with this account. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select **Accounts** in the left-hand menu.
  - **Expected:** The table lists the development accounts, as [Development Setup](../design/development-setup.md#development-accounts) lists them, and no other. The filter beside the search box reads **All 12**, **Active 12** and **Deactivated 0**.
  - **Notes:**

- [ ] **Step 2.** Select **New account**. Type `Fictional Planning Lead` in **Name** and `fictional.planning.lead@fathom.test` in **Email address**. Under **Roles**, tick **Product Manager** and **Workforce Administrator**, and untick **Team Member**.
  - **Expected:** **Default role** appears under the roles, offering **Product Manager** and **Workforce Administrator**, in the order of the role list.
  - **Notes:**

- [ ] **Step 3.** Choose **Workforce Administrator** under **Default role**, and select **Create account**. Select the eye button, write the password down, and select **Done**.
  - **Expected:** The dialog is titled **Password for Fictional Planning Lead**. Once **Done** is selected, a green banner says **Created the account for Fictional Planning Lead.**, and the row's **Roles** cell shows **Workforce Administrator (default)** then **Product Manager**.
  - **Notes:**

#### ACC-44: People Are Pasted Into an Empty People Table and Approved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-43. Step 7 signs in as another account.

**Preconditions:** ACC-43 done. Signed in with this account. In the text editor, seven lines, typed with the Tab key where shown:

- **Odile Brandt**, Tab, **EMP-100**, Tab, **Manager**, Tab, **Hired**
- **Ada Quill**, Tab, **EMP-101**, Tab, **Manager**, Tab, **Hired**
- **Bram Oakes**, Tab, **EMP-102**, Tab, **Employee**, Tab, **Hired**
- **Cleo Marsh**, Tab, **EMP-103**, Tab, **Employee**, Tab, **Hired**
- **Dara Finch**, Tab, **EMP-104**, Tab, **Employee**, Tab, **Hired**
- **Emil Stone**, Tab, **EMP-105**, Tab, **Employee**, Tab, **Hired**
- **Freya Holt**, Tab, **EMP-106**, Tab, **Employee**, Tab, **Hired**

- [ ] **Step 1.** Select **People** in the left-hand menu.
  - **Expected:** The table has its column names and only the empty row. The count above the table reads **0 people**.
  - **Notes:**

- [ ] **Step 2.** Select **Org chart** in the left-hand menu.
  - **Expected:** The page reads **Nobody is on the org chart yet.**
  - **Notes:**

- [ ] **Step 3.** Select **Change history** in the left-hand menu.
  - **Expected:** The page reads **No changes to data you can see yet.**
  - **Notes:**

- [ ] **Step 4.** Select **People**. Copy the seven lines from the text editor, select the **Name** cell of the empty row, and paste.
  - **Expected:** Seven rows are added, one for each line, each with its ID, **Manager** or **Employee** in **Position**, **Hired** in **State**, and a hollow yellow dot and **Draft**. The count reads **7 people**.
  - **Notes:**

- [ ] **Step 5.** Click once in the **Manager?** cell of **Odile Brandt**, then of **Ada Quill**.
  - **Expected:** Both boxes are checked. The other rows' boxes stay clear.
  - **Notes:**

- [ ] **Step 6.** Publish (P1).
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 7.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`. Select **Drafts**, tick **Select all waiting**, then select **Approve 7 drafts**, then **Approve** in the dialog titled **Approve 7 drafts?**.
  - **Expected:** A notice reads **Approved 7 drafts.**, and the page says **No drafts waiting for approval.**
  - **Notes:**

#### ACC-45: Reporting Lines and a Planned Hire Are Added

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-44. Step 4 signs in as another account.

**Preconditions:** ACC-44 done. Signed in with this account. **People** page open.

- [ ] **Step 1.** Select the **Manager** cell of **Bram Oakes**, press Enter, type `Ada`, and choose **Ada Quill**.
  - **Expected:** The **Manager** cell reads **Ada Quill**, in yellow, and **Manager since** holds today's date. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** In the same way, choose **Ada Quill** as the manager of **Cleo Marsh** and **Freya Holt**, and **Odile Brandt** as the manager of **Ada Quill**, **Dara Finch** and **Emil Stone**.
  - **Expected:** Each of the six rows reads its new manager, and has a hollow yellow dot and **Draft**. **Odile Brandt** has no manager.
  - **Notes:**

- [ ] **Step 3.** Select **New** at the top right of the page. Select the change button beside **State**, and choose **Request to hire**. Type `Fictional tide engineer` in **Name**, `REQ-7001` in **ID**, and the first day of three months from now in **Start**, such as `20270201`. Choose **Employee** in **Position** and **Ada Quill** in **Manager** from their change buttons, and select **Add**.
  - **Expected:** The panel shows **Fictional tide engineer**. Its row reads **Request to hire** in **State** and **Ada Quill** in **Manager**, with a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 4.** Publish (P1). Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`. Select **Drafts**, tick **Select all waiting**, then select **Approve 7 drafts**, then **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 7 drafts.**, and the page says **No drafts waiting for approval.**
  - **Notes:**

#### ACC-46: A Team Member Reads the New Organization

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-45.

**Preconditions:** ACC-45 done. Signed in with this account. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select **Org chart** in the left-hand menu.
  - **Expected:** **Odile Brandt** is at the top, with **Manager** under the name, and her card ends with **Hide 3 reports**. **Dara Finch** and **Emil Stone** are in a column under her, and **Ada Quill**, with **Manager** under the name, is to the right of that column, her card ending with **Show 4 reports**.
  - **Notes:**

- [ ] **Step 2.** On the card for **Ada Quill**, select **Show 4 reports**.
  - **Expected:** **Bram Oakes**, **Cleo Marsh** and **Freya Holt** appear in a column under her, then a card with a grey dashed edge for **Fictional tide engineer**, with **Employee** under it, then a hollow grey dot, **Planned, expected** and the month three months from now, such as **Feb 2027**.
  - **Notes:**

- [ ] **Step 3.** Choose **Feature teams** in the teams switch, and select the Feature teams button.
  - **Expected:** The menu reads **No feature teams yet**, and offers no **New feature team**.
  - **Notes:**

#### ACC-47: The Planning Lead Sets Up a Release Stream and Makes a Release

**Account:** Planning lead, `fictional.planning.lead@fathom.test`, changed from ACC-46.

**Preconditions:** ACC-43 done. Signed out.

- [ ] **Step 1.** Sign in as the planning lead, with the password written down in ACC-43.
  - **Expected:** A panel headed **Change password** says **Fathom generated this password. A new password is required to continue.**
  - **Notes:**

- [ ] **Step 2.** Enter the password written down in **Current password**, and `fictional password 3` in **New password** and **New password again**, and select **Change password**.
  - **Expected:** A green banner says **Your password has been changed, and you have been signed out everywhere else.**, and Fathom opens with the left-hand menu.
  - **Notes:**

- [ ] **Step 3.** Select **Releases** in the left-hand menu.
  - **Expected:** The page reads **No release streams yet.**, with a **New release stream** button at the top right.
  - **Notes:**

- [ ] **Step 4.** Select **New release stream**, type `Fictional Mainline` in **Name**, and select **Add stream**.
  - **Expected:** A notification says **Drafted the new release stream.** The side panel is headed **Fictional Mainline**, with a hollow yellow dot and **Draft: added**, **No cycles yet.** under **Cycle schedule**, **No releases yet.** under **Releases**, and no **New release…** button.
  - **Notes:**

- [ ] **Step 5.** Select **Set up cycles…**, and type `20270101` in **First cycle starts**, leaving **Each cycle lasts** at **3**, **Months**, and **Names** at **{YY}.{N}**.
  - **Expected:** Under **First cycles**: **27.1** with **2027-01-01 to 2027-03-31**, **27.2** with **2027-04-01 to 2027-06-30**, and **27.3** with **2027-07-01 to 2027-09-30**.
  - **Notes:**

- [ ] **Step 6.** Select **Set up cycles**, then publish (P1).
  - **Expected:** A notification says **Drafted the cycles.** Under **Cycle schedule**, a row reads **From 2027-01-01**, then **Every 3 months, named {YY}.{N}**.
  - **Notes:**

- [ ] **Step 7.** Choose **Product Manager** in the role menu.
  - **Expected:** The page stays on **Releases**, with **Fictional Mainline** open, and **New release…** shows under **Releases**.
  - **Notes:**

- [ ] **Step 8.** Select **New release…**. Type `Fictional Mainline 1` in **Name**, choose **27.1 (2027-01-01 to 2027-03-31)** as the first cycle and **27.2 (2027-04-01 to 2027-06-30)** as the last, and type `20270615` in **Ships on**.
  - **Expected:** Under **Ships on**, the dialog reads **Ships 15 days before 27.2 ends**.
  - **Notes:**

- [ ] **Step 9.** Select **Make release**, then publish (P1).
  - **Expected:** A notification says **Drafted the new release.** Under **Releases**, a row reads **Fictional Mainline 1**, with a yellow dot and **Draft: added**, then **27.1 to 27.2 · ships 2027-06-15**, followed in bold by **15 days before 27.2 ends**.
  - **Notes:**

#### ACC-48: A Product Manager Starts the Plan

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACC-47.

**Preconditions:** ACC-45 done. Signed in with this account.

- [ ] **Step 1.** Select **Projects** in the left-hand menu.
  - **Expected:** The **Projects** tab is chosen. The table has only its empty row, and the count above it reads **0 projects**.
  - **Notes:**

- [ ] **Step 2.** Select the **Customers** tab. Select the **Name** cell of the empty row, type `Fictional Lighthouse Trust`, and press Enter.
  - **Expected:** A row **Fictional Lighthouse Trust** is added, with a hollow yellow dot and **Draft: added**, and a new empty row is under it.
  - **Notes:**

- [ ] **Step 3.** Select the **Proposals** tab, then **New proposal**. Type `Fictional Lighthouse Bid` in **Name**, and select **Add**.
  - **Expected:** The side panel is headed **Fictional Lighthouse Bid** with a hollow yellow dot and **Draft: added**, and **Status** reads **Open**.
  - **Notes:**

- [ ] **Step 4.** Select the **Projects** tab, then **New project**. Type `Fictional Lamp Room` in **Name** and `FLR-1` in **Project ID**. Using the pencil buttons, pick **Ada Quill** in **Owner**, **Fictional Lighthouse Trust** in **Customers** and **Fictional Lighthouse Bid** in **Proposals**, and select **Add**.
  - **Expected:** The side panel is headed **Fictional Lamp Room** with a hollow yellow dot and **Draft: added**, and under **Milestones** reads **No milestones yet**.
  - **Notes:**

- [ ] **Step 5.** Select **Features** in the left-hand menu.
  - **Expected:** The table has no group headings and only its empty row, and the count above it reads **0 features**.
  - **Notes:**

- [ ] **Step 6.** Select **New feature**. Type `Fictional Tide Tables` in **Name**. Using the pencil buttons, choose **Planned** in **Status** and **Fictional Lighthouse Trust** in **Customers**, and select **Add**.
  - **Expected:** The feature's details are headed **Fictional Tide Tables** with a hollow yellow dot and **Draft: added**. In the table, its **Feature team** cell shows a **No team** mark.
  - **Notes:**

- [ ] **Step 7.** Publish (P1).
  - **Expected:** The Publish button is gone.
  - **Notes:**

#### ACC-49: A Project Manager Approves the Plan and the Release Together

**Account:** Project Manager, `project.manager@fathom.test`, changed from ACC-48.

**Preconditions:** ACC-47 and ACC-48 done. Signed in with this account.

- [ ] **Step 1.** Select **Drafts** in the left-hand menu.
  - **Expected:** Seven entries, each with a checkbox, one each for the release stream **Fictional Mainline**, its cycles from **2027-01-01**, the release **Fictional Mainline 1**, the customer **Fictional Lighthouse Trust**, the proposal **Fictional Lighthouse Bid**, the project **Fictional Lamp Room** and the feature **Fictional Tide Tables**.
  - **Notes:**

- [ ] **Step 2.** Tick **Select all waiting**, then select **Approve 7 drafts**, then **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 7 drafts.**, and the page says **No drafts waiting for approval.**
  - **Notes:**

- [ ] **Step 3.** Select **Releases**, then **Fictional Mainline** in the streams table.
  - **Expected:** No row in the side panel has a mark. **Fictional Mainline 1** still ships on **2027-06-15**, **15 days before 27.2 ends**.
  - **Notes:**

#### ACC-50: Feature Teams Are Recorded From Six Months Ago

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-49. Step 8 signs in as another account.

**Preconditions:** ACC-45 done. Signed in with this account.

- [ ] **Step 1.** Select **Feature assignments** in the left-hand menu, then **Feature team** in the Group by menu.
  - **Expected:** Every person is listed under **No feature team**, and no cell in any month holds a label.
  - **Notes:**

- [ ] **Step 2.** Select **Org chart**, choose **Feature teams** in the teams switch, and select the Feature teams button.
  - **Expected:** The menu reads **No feature teams yet**, then offers **New feature team**.
  - **Notes:**

- [ ] **Step 3.** Select **New feature team**.
  - **Expected:** A panel titled **New feature team** opens, with a **Name** box, the line **Name the team first; then add its members and choose its lead.**, and **Add feature team** greyed out.
  - **Notes:**

- [ ] **Step 4.** Type `Tide team`, and press Enter.
  - **Expected:** The panel's **Team** reads **Tide team**, with a hollow yellow dot and **Draft: added**, and **Members** reads **No members yet.** On the chart, a card named **Tide team** reads **No feature lead**.
  - **Notes:**

- [ ] **Step 5.** In **Add member**, choose **Ada Quill**, then **Bram Oakes**, then **Cleo Marsh**. Clear **Takes effect from**, type the first day of six months ago, such as `20260501`, and press Enter.
  - **Expected:** The three are listed among the members, each with a yellow dot and **Draft: added**. A notice reads **Date changed**, with **Undo**.
  - **Notes:**

- [ ] **Step 6.** From the Feature teams button, select **New feature team**, type `Harbour team`, and press Enter. Add **Dara Finch** and **Emil Stone**, choose **Dara Finch** in **Feature lead**, and set **Takes effect from** to the first day of six months ago.
  - **Expected:** The members read **Dara Finch (lead)** and **Emil Stone**. A notice reads **Date changed**, with **Undo**.
  - **Notes:**

- [ ] **Step 7.** Add a new feature team, `Beacon team`, the same way, with **Cleo Marsh** and **Freya Holt** as members and no lead, and set **Takes effect from** to the first day of six months ago.
  - **Expected:** **Cleo Marsh** is offered in **Add member**, though she is on **Tide team** too. On the chart, a card for **Cleo Marsh** is under both **Tide team** and **Beacon team**.
  - **Notes:**

- [ ] **Step 8.** Publish (P1). Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`. Select **Drafts**, tick **Select all waiting**, then select **Approve 3 drafts**, then **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 3 drafts.**
  - **Notes:**

#### ACC-51: A Lead Starts Later, Someone Moves Team, and a Team Disbands

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-50. Step 4 signs in as another account.

**Preconditions:** ACC-50 done. Signed in with this account. **Org chart** page open, with **Feature teams** chosen in the teams switch.

- [ ] **Step 1.** Select the Feature teams button, then **Tide team**. Choose **Ada Quill** in **Feature lead**, and select the **×** at the right of **Bram Oakes**. Set **Takes effect from** to the first day of three months ago, such as `20260801`.
  - **Expected:** The members read **Ada Quill (lead)** and **Cleo Marsh**, and a line under them reads **Bram Oakes, leaving**, marked **Live**. A notice reads **Date changed**, with **Undo**.
  - **Notes:**

- [ ] **Step 2.** Open **Harbour team** from the Feature teams button. Add **Bram Oakes**, and set **Takes effect from** to the first day of three months ago.
  - **Expected:** **Bram Oakes** is listed among the members with a yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 3.** Open **Beacon team**. Select the **×** at the right of **Cleo Marsh**, then of **Freya Holt**, and set **Takes effect from** to the first day of last month, such as `20261001`.
  - **Expected:** No members are listed. Lines read **Cleo Marsh, leaving** and **Freya Holt, leaving**, each marked **Live**.
  - **Notes:**

- [ ] **Step 4.** Publish (P1). Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`. Select **Drafts**, tick **Select all waiting**, then select **Approve 3 drafts**, then **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 3 drafts.**
  - **Notes:**

#### ACC-52: The Org Chart Shows Each Team as It Was Month by Month

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-51.

**Preconditions:** ACC-51 done. Signed in with this account. **Org chart** page open, with **Feature teams** chosen in the teams switch.

- [ ] **Step 1.** Read the chart.
  - **Expected:** **Ada Quill**'s card is named **Tide team**, with **Cleo Marsh** under it. **Dara Finch**'s card is named **Harbour team**, with **Bram Oakes** and **Emil Stone** under it. A card named **Beacon team** reads **No feature lead**, with no cards under it.
  - **Notes:**

- [ ] **Step 2.** Clear the date box, type the first day of six months ago, such as `20260501`, and press Enter.
  - **Expected:** Below the row, text reads **Showing** and that day, such as **Showing May 1, 2026.**, then **Nothing can be changed on this date.** A card named **Tide team** reads **No feature lead**, with **Ada Quill**, **Bram Oakes** and **Cleo Marsh** under it. **Dara Finch**'s card is named **Harbour team**, with **Emil Stone** under it. A card named **Beacon team** reads **No feature lead**, with **Cleo Marsh** and **Freya Holt** under it.
  - **Notes:**

- [ ] **Step 3.** Select the right arrow three times.
  - **Expected:** The date box shows the first day of three months ago. **Ada Quill**'s card is named **Tide team**, with **Cleo Marsh** under it, and **Bram Oakes** is under **Harbour team**. **Beacon team** is as in step 2.
  - **Notes:**

- [ ] **Step 4.** Select the right arrow twice.
  - **Expected:** The date box shows the first day of last month. Only **Tide team** and **Harbour team** are drawn, and no card names **Beacon team**.
  - **Notes:**

- [ ] **Step 5.** Select **Today**.
  - **Expected:** The text below the row goes, and the chart is as in step 1.
  - **Notes:**

#### ACC-53: Feature Assignments Show the Changes by Month

**Account:** Team Member, `team.member@fathom.test`, changed from ACC-52.

**Preconditions:** ACC-51 done. Signed in with this account.

- [ ] **Step 1.** Select **Feature assignments** in the left-hand menu.
  - **Expected:** The button reads **Group by: Feature team**. The groups are **Beacon team**, **Harbour team**, **Tide team** and **No feature team**, in that order, and **Odile Brandt** is under **No feature team**.
  - **Notes:**

- [ ] **Step 2.** Open the **Person** column menu, select **Filter…**, type `Bram`, and press Esc.
  - **Expected:** **Bram Oakes** is listed under **Harbour team** and under **Tide team**. In each of his rows, the current month's cell holds a **Harbour team** label.
  - **Notes:**

- [ ] **Step 3.** Scroll the table to the left until the column for seven months ago is in view, and read one of **Bram Oakes**'s rows from left to right.
  - **Expected:** The cell for seven months ago holds no label. From six months ago to four months ago, each cell holds a **Tide team** label. From three months ago on, each holds a **Harbour team** label.
  - **Notes:**

- [ ] **Step 4.** Open the **Person** column menu, select **Filter…**, replace `Bram` with `Cleo`, and press Esc; then do the same with `Freya`. Read their rows the same way.
  - **Expected:** From six months ago to two months ago, **Cleo Marsh**'s cells hold a **Beacon team** label and a **Tide team** label, and from last month on, only **Tide team**. **Freya Holt**'s cells hold a **Beacon team** label from six months ago to two months ago, and none from last month on.
  - **Notes:**

#### ACC-54: A Feature Lead Gives the Feature Its Team and Cycle

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-53. Step 4 signs in as another account.

**Preconditions:** ACC-49 and ACC-50 done. Signed in with this account, acting as **Feature Lead**. **Features** page open.

- [ ] **Step 1.** Select the **Feature team** cell of **Fictional Tide Tables**, and press Enter.
  - **Expected:** The choices are **Beacon team**, **Harbour team** and **Tide team**.
  - **Notes:**

- [ ] **Step 2.** Choose **Tide team**, and press Enter.
  - **Expected:** The cell reads **Tide team**, in yellow, and the **No team** mark is gone. The row has a hollow yellow dot and **Draft**, with a Live row under it.
  - **Notes:**

- [ ] **Step 3.** Select the row's **Target cycle** cell, press Enter, choose **Fictional Mainline: 27.1**, and press Enter. Publish (P1).
  - **Expected:** The cell reads **Fictional Mainline: 27.1**, in yellow, and the dot on the row is filled.
  - **Notes:**

- [ ] **Step 4.** Sign out, and sign in as the Product Manager, `product.manager@fathom.test`. Open **Features**, open the ⋯ menu of **Fictional Tide Tables**, select **Approve draft**, then **Approve** in the dialog titled **Approve 1 draft?**.
  - **Expected:** A notice reads **Approved 1 draft.** **Fictional Tide Tables** has no mark, reads **Tide team** in **Feature team**, and is under the heading **Fictional Mainline: 27.1**.
  - **Notes:**

**Afterwards:** R2.
