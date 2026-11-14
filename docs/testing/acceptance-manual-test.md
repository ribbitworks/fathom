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

Verifies Fathom's common use by every persona in [Roles](../product/roles.md#roles-by-persona), in journeys that pass work from one account to the next: hiring and People, saved views, the org chart, feature teams and feature assignments, lists, the plan as an Executive reads it, and administration. An organization setting Fathom up from an empty database is verified by [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) and [Work Between Roles](acceptance-work-between-roles-manual-test.md). Each feature is run once as it is usually used and once in a less usual way. The feature manual tests in `docs/testing/` cover each feature in depth.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A browser window at least 1,440 pixels wide.
- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses the account of each persona in [Roles](../product/roles.md#roles-by-persona):

- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`
- **Engineering Manager:** `engineering.manager@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`, holding the Feature Lead role, its default, and the Engineering Manager role
- **Engineering Director:** `engineering.director@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Executive:** `executive@fathom.test`
- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as "Fathom Administrator"

This test creates:

- **New account:** `fictional.newcomer@fathom.test`, shown in Fathom as `Fictional Newcomer`. ACC-37 creates it with the Team Member role, and its password is the one ACC-37 shows, until ACC-37 changes it to `fictional password 2`. ACC-38 gives it the `Fictional Reader` role in place of Team Member.

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the account menu, marks, the lock, boxes, a row's slot, Draft rows and Live rows, the Publish button, the finder, the teams switch and the team panel. This test adds:

- **Months from today:** the steps name months by where they fall from the current month: **last month** is the one before it, and **two months after the current month** the second month after it.
- **Empty row:** the row at the end of a table or a list's panel, with blank cells, where a new record or choice is typed.
- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**. Accounts that don't see Personal details have the arrows, timeline and **Today** without it.

## Test Cases

Run the test cases in order, in about an hour and a half. Start with Start Fathom, then Reset the Database; the last test case runs Reset the Database to put everything back. Check each step whose expected result you see, and write anything else under its notes.

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

Moved to [Team Member](acceptance-team-member-manual-test.md), MEMBER-04.

#### ACC-10: A Shared View Is Seen by Others Until It Is Taken Back

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, in the main browser, the same as ACC-08. The second browser signs in as another account in step `F3B1`.

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

Moved to [Team Member](acceptance-team-member-manual-test.md), MEMBER-01.

#### ACC-12: An Engineering Manager Reads a Note Beside the Chart

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ACC-10.

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

Moved to [Feature Lead](acceptance-feature-lead-manual-test.md), LEAD-01.

#### ACC-15: A Project Manager Approves the Feature Team

Moved to [Feature Lead](acceptance-feature-lead-manual-test.md), LEAD-02.

#### ACC-16: A Member Joins a Feature Team From an Earlier Date

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-13. Step `2A2C` signs in as another account.

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

**Preconditions:** ACC-16 done. Signed in with this account. **Feature assignments** page open from the left-hand menu, with **Feature team** chosen in the Group by menu.

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

Moved to [Project Manager](acceptance-project-manager-manual-test.md), PROJECT-02.

#### ACC-19: The Feature Lead, Acting as Engineering Manager, Plans a Team Change in Feature Assignments

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from ACC-17.

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

Covered by [Team Member](acceptance-team-member-manual-test.md), MEMBER-02.

### Journey 4: The Plan

#### ACC-21: A Product Manager Adds a Customer, a Proposal and a Project With Milestones

Moved to [Product Manager](acceptance-product-manager-manual-test.md), PRODUCT-01.

#### ACC-22: A Project Manager Approves the Project and Its Milestones

Moved to [Product Manager](acceptance-product-manager-manual-test.md), PRODUCT-02.

#### ACC-23: A Product Manager Adds a Feature With a Formatted Note

Covered by [Product Manager](acceptance-product-manager-manual-test.md), PRODUCT-03, and the [Notes](notes-manual-test.md) manual test.

#### ACC-24: Leaving the New Feature Panel Asks First

Covered by the [Features](features-manual-test.md) manual test.

#### ACC-25: A Feature Linked From Features Is Found From Its Project

Covered by [Product Manager](acceptance-product-manager-manual-test.md), PRODUCT-04, and the [Feature Links](feature-links-manual-test.md) manual test.

#### ACC-26: A Feature Status Is Added to Its List

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ACC-19. Step `A33C` signs in as another account.

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

Moved to [Product Manager](acceptance-product-manager-manual-test.md), PRODUCT-06.

#### ACC-29: A Rejected Change Is Resubmitted and Approved

Moved to [Product Manager](acceptance-product-manager-manual-test.md), PRODUCT-07.

#### ACC-30: The Change History Tells How a Draft Went

Moved to [Product Manager](acceptance-product-manager-manual-test.md), PRODUCT-08.

#### ACC-31: A Shorter Cycle Moves a Release and Its Features

Covered by the [Releases](releases-manual-test.md) manual test.

#### ACC-32: A Product Manager Makes a Release

Moved to [Product Manager](acceptance-product-manager-manual-test.md), PRODUCT-05.

#### ACC-33: An Executive Reads the Plan

**Account:** Executive, `executive@fathom.test`, changed from ACC-27.

**Preconditions:** Signed in with this account.

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

- [ ] `7DFE` Select the details button at the right of the **Stream** cell of 'Platform'.
  - **Expected:**
    - There is no **New release stream** button.
    - There is no **New release…** button.
    - 'Harbor 1' has no **⋯** button at its end.
  - **Notes:**

- [ ] `7C20` Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `0CAA` Select **All** on the timeline.
  - **Expected:** Each stream's lane shows from its first cycle to its last without scrolling.
  - **Notes:**

- [ ] `E950` Hover over the span of 'Harbor 3'.
  - **Expected:** A tooltip names 'Harbor 3', its cycles and the day it ships.
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

Moved to [Team Member](acceptance-team-member-manual-test.md), MEMBER-02.

#### ACC-36: Removing a Project Removes Its Milestones

Covered by the [Projects](projects-manual-test.md) manual test.

### Journey 5: Administration

#### ACC-37: A New Account Signs In for the First Time

**Account:** Administrator, `fathom.administrator@fathom.test`, in the main browser, changed from ACC-34. The second browser signs in as the new account in step `BC14`.

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

Moved to [Feature Lead](acceptance-feature-lead-manual-test.md), LEAD-06.

#### ACC-43: The Change History Names the Role a Change Was Made As

Moved to [Feature Lead](acceptance-feature-lead-manual-test.md), LEAD-07.

#### ACC-44: Each Browser Keeps Its Own Appearance

Covered by the [Dark Mode](dark-mode-manual-test.md) manual test.

#### ACC-45: Put Everything Back

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ACC-41. Step `B5CA` signs in again with this account.

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

Moved to [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md), SETUP-01.

#### ACC-47: People Are Pasted Into an Empty People Table and Approved

Moved to [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md), SETUP-03 and SETUP-04.

#### ACC-48: Reporting Lines and a Planned Hire Are Added

Moved to [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md), SETUP-05.

#### ACC-49: A Team Member Reads the New Organization

Moved to [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md), SETUP-09.

#### ACC-50: The Planning Lead Sets Up a Release Stream and Makes a Release

Moved to [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md), SETUP-02 and SETUP-06.

#### ACC-51: A Product Manager Starts the Plan

Moved to [Work Between Roles](acceptance-work-between-roles-manual-test.md), WORK-01.

#### ACC-52: A Project Manager Approves the Plan and the Release Together

Moved to [Work Between Roles](acceptance-work-between-roles-manual-test.md), WORK-02.

#### ACC-53: Feature Teams Are Recorded From Six Months Ago

Moved to [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md), SETUP-08.

#### ACC-54: The Feature Lead, Acting as Engineering Manager, Plans Team Changes Months Ahead

Moved to [Work Between Roles](acceptance-work-between-roles-manual-test.md), WORK-03.

#### ACC-55: The Org Chart Shows Each Team Month by Month

Moved to [Work Between Roles](acceptance-work-between-roles-manual-test.md), WORK-04.

#### ACC-56: Feature Assignments Show the Changes by Month

Moved to [Work Between Roles](acceptance-work-between-roles-manual-test.md), WORK-05.

#### ACC-57: A Feature Lead Gives the Feature Its Team and Cycle

Covered by [Work Between Roles](acceptance-work-between-roles-manual-test.md), WORK-01.
