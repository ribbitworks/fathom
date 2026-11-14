---
title: "Manual Test: Acceptance, Workforce Administrator"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-a-workforce-administrator.md", "docs/product/roles.md"]
last_updated: "2026-11-14"
---

# Manual Test: Acceptance, Workforce Administrator

## Scope

Verifies the workflows of [Working as a Workforce Administrator](../../help/working-as-a-workforce-administrator.md) on the seed data: keeping people current with a leaving date and a new manager, keeping the hiring plan with a planned hire and its state, keeping a list current, putting someone on a feature team from an earlier month, and changing a planning setting, each approved by a Project Manager or the Engineering Director. Choosing classes is verified in [Engineering Director](acceptance-engineering-director-manual-test.md).

## Test Environment

As [Manual Test Basics](../manual-test-basics.md#test-environment) sets out, with a browser window at least 1,440 pixels wide.

## Test Accounts

As [Manual Test Basics](../manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Project Manager:** `project.manager@fathom.test`
- **Engineering Director:** `engineering.director@fathom.test`

## Common Procedures

This test uses [Start Fathom](../manual-test-basics.md#start-fathom), [Reset the Database](../manual-test-basics.md#reset-the-database) and [Publish](../manual-test-basics.md#publish).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **Months from today:** the steps name months by where they fall from the current month: **last month** is the one before it, and the **month before last month** the one before that. The examples after "such as" are for a run in November 2026.
- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20301231`.
- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### WORKFORCE-01: A Planned Hire Is Added and Approved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step `BCEB` signs in as another account.

**Preconditions:** Reset the Database run. Signed in with this account. **People** page open from the left-hand menu.

- [ ] `72EE` Select **New person** at the top right of the page.
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

- [ ] `222E` Select **Approve 1 draft…**.
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

### WORKFORCE-02: A Hire's State and a Leaving Date Are Drafted

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from WORKFORCE-01.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu, with no filters.

- [ ] `77C9` Search for `Engineering Manager TBD`.
  - **Expected:** Among the rows listed, one's **Name** reads "Engineering Manager, TBD-" and a number.
  - **Notes:**

- [ ] `28CF` Select that row's **State** cell, press Enter, choose **Approved to hire**, and press Enter.
  - **Expected:** A **Fill** button shows in that row's **Name** cell.
  - **Notes:**

- [ ] `EF3E` Search for `Tanushree Patel-Singh`.
  - **Expected:** A row for 'Tanushree Patel-Singh' is listed.
  - **Notes:**

- [ ] `485E` Select her **End** cell, press Enter, type `20301231`, and press Enter.
  - **Expected:**
    - The cell reads the date typed, with a hollow yellow dot before it.
    - The row is faintly yellow.
  - **Notes:**

- [ ] `3D16` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

### WORKFORCE-03: A New Manager Moves Someone to Their Team

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as WORKFORCE-02. Step `809A` signs in as another account.

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

- [ ] `E68F` Select **Approve 1 draft…**.
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

### WORKFORCE-04: A Feature Status Is Added to Its List

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from WORKFORCE-03. Step `A33C` signs in as another account.

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

### WORKFORCE-05: The Last Status for a Meaning Is Kept

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from WORKFORCE-04.

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

- [ ] `A06F` Select **Retire**.
  - **Expected:**
    - **Possible** stays where it is, with a hollow yellow dot in its slot.
    - A yellow **Retired** box is after its name.
  - **Notes:**

### WORKFORCE-06: A Member Joins a Feature Team From an Earlier Date

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as WORKFORCE-05. Step `2A2C` signs in as another account.

**Preconditions:** Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

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

- [ ] `B930` Type `Candice`, and press Enter.
  - **Expected:** 'Candice Swift' has a tick.
  - **Notes:**

- [ ] `08EB` Press Enter.
  - **Expected:**
    - **Members** lists 'Candice Swift', with a hollow yellow dot before her name.
    - No date is after her name.
  - **Notes:**

- [ ] `CBE2` Select **Today**.
  - **Expected:**
    - The text below the row is gone.
    - In the team panel, 'Candice Swift' has a hollow yellow dot before her name, followed in grey by "from" and the first day of last month.
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

- [ ] `9AF6` Type `Candice` in the search box.
  - **Expected:**
    - One entry is listed, "the feature team Search and discovery".
    - Its **Members** line adds "Candice Swift".
    - Its **Joining and leaving dates** line gives "Candice Swift" and the first day of last month.
  - **Notes:**

- [ ] `F1BE` Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `BD38` Select **Approve 1 draft…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `9AD4` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice begins "Approved".
  - **Notes:**

### WORKFORCE-07: Feature Assignments Show the Earlier Join

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from WORKFORCE-06.

**Preconditions:** WORKFORCE-06 done. Signed in with this account.

- [ ] `8D15` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The page is headed **Feature assignments**.
  - **Notes:**

- [ ] `D898` Select **Feature team** in the Group by menu.
  - **Expected:** The rows are grouped under the feature teams, then **No feature team**.
  - **Notes:**

- [ ] `264A` Open the **Person** column menu, and select **Filter…**.
  - **Expected:** A box for the name opens.
  - **Notes:**

- [ ] `B755` Type `Candice`.
  - **Expected:**
    - Only 'Candice Swift' is listed, under the 'Search and discovery' group.
    - Her current month's cell holds a 'Search and discovery' label.
  - **Notes:**

- [ ] `9B41` Press Esc.
  - **Expected:** The filter closes.
  - **Notes:**

- [ ] `9F00` Scroll the table one month to the left.
  - **Expected:**
    - The **Person** column stays in place.
    - Last month's cell for 'Candice Swift' holds a 'Search and discovery' label too.
    - The month before it holds no label.
  - **Notes:**

### WORKFORCE-08: A Planning Setting Is Changed and Approved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as WORKFORCE-07. Step `A2F8` signs in as another account.

**Preconditions:** None beyond WORKFORCE-07.

- [ ] `17DE` Select the **Capacity** page in the left-hand menu.
  - **Expected:** The mode switch has **People** chosen.
  - **Notes:**

- [ ] `D402` Select **Settings** in the mode switch.
  - **Expected:** Under **Working time**, **Hours a day** reads "8".
  - **Notes:**

- [ ] `13B0` Select "8" beside **Hours a day**.
  - **Expected:** A field in place of "8" holds "8".
  - **Notes:**

- [ ] `71EA` Replace the value with `4`, and press Enter.
  - **Expected:**
    - **Hours a day** reads "4" after a hollow yellow mark.
    - Under it, "8" follows a green mark.
  - **Notes:**

- [ ] `F41C` Run Publish.
  - **Expected:** The mark before "4" is filled yellow.
  - **Notes:**

- [ ] `A2F8` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `6AC7` Select the **Capacity** page in the left-hand menu.
  - **Expected:** The mode switch has **People** chosen.
  - **Notes:**

- [ ] `BE47` Select **Settings** in the mode switch.
  - **Expected:** **Hours a day** reads "4" after a yellow mark.
  - **Notes:**

- [ ] `B555` Select the **⋯** button at the right of the **Hours a day** row.
  - **Expected:**
    - A menu headed **Planning settings** opens.
    - Under the heading, a yellow mark and "Draft: changed".
    - Under that, "Hours a day from 8 to 4, by Engineering Operations Manager".
    - Then **Approve…**, **Reject…** and **Discard draft**.
  - **Notes:**

- [ ] `C128` Select **Approve…**.
  - **Expected:** A dialog headed "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `289D` Select **Approve**.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - **Hours a day** reads "4", with no mark and nothing under it.
  - **Notes:**

**Afterwards:** Run Reset the Database.
