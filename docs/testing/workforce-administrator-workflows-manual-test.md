---
title: "Manual Test: Workforce Administrator Workflows"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-a-workforce-administrator.md", "docs/product/roles.md"]
last_updated: "2026-11-27"
---

# Manual Test: Workforce Administrator Workflows

## Scope

Verifies the jobs of [Working as a Workforce Administrator](../help/working-as-a-workforce-administrator.md) on the seed data, with some of the drafts approved by a Project Manager or the Engineering Director:

- The role the **Overview** says the account is acting as, and its link to People.
- Keeping people current: a leaving date and a new manager.
- Planning the hiring: requesting a hire and marking one approved to hire.
- Keeping the feature teams current: moving someone to another team from next month.
- Setting up the choices people pick from: adding a choice and retiring one.
- Setting the working time: the hours a day.

[Engineering Director](engineering-director-workflows-manual-test.md) verifies filling a hire and choosing classes.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with a browser window at least 1,440 pixels wide.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Project Manager:** `project.manager@fathom.test`
- **Engineering Director:** `engineering.director@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database) and [Publish](manual-test-basics.md#publish).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20301231`.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Reset the Database. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### WORKFORCE-01: A Planned Hire Is Requested

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Reset the Database run. Signed in with this account, with the **Overview** page open.

- [ ] `C6DD` Look at the **Overview** page.
  - **Expected:** It reads "Acting as Workforce Administrator".
  - **Notes:**

- [ ] `A92A` Select the **People** link beside **Plan the Hiring**, under **People**.
  - **Expected:** The **People** page opens.
  - **Notes:**

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

### WORKFORCE-02: A Hire's State and a Leaving Date Are Drafted

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as WORKFORCE-01.

**Preconditions:** **People** page open, with no filters.

- [ ] `332F` Search for `Mobile developer`.
  - **Expected:**
    - Among the rows listed is a hire row named 'Mobile developer'.
    - It reads 'REQ-2055' in **ID**.
    - It reads "Request to hire" in **State**.
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
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `65D6` Type `Samuel Richter` in the search box.
  - **Expected:** A row whose **Record** reads 'Samuel Richter' is listed, with a tick box.
  - **Notes:**

- [ ] `F760` Tick that row's tick box.
  - **Expected:**
    - The tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `E68F` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `FE6E` Select **Approve** in the dialog.
  - **Expected:** A notification says "Approved 1 draft."
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

- [ ] `04AC` Select the details button of **Statuses**.
  - **Expected:**
    - The panel opens with **Statuses** at the top.
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

- [ ] `34EE` Select the details button of **Statuses**.
  - **Expected:** The panel opens with **Statuses** at the top.
  - **Notes:**

- [ ] `DAC6` Select the **⋯** button at the end of the `Long shot` row, then **Approve…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `F27E` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - `Long shot` has no dot.
  - **Notes:**

### WORKFORCE-05: A Status Is Retired

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from WORKFORCE-04.

**Preconditions:** Signed in with this account. **Lists** page open, with the **Statuses** panel open.

- [ ] `6B24` Select the **⋯** button at the end of the **Possible** row.
  - **Expected:** The menu opens, and **Retire** can be selected.
  - **Notes:**

- [ ] `A06F` Select **Retire**.
  - **Expected:**
    - **Possible** stays where it is, with a hollow yellow dot in its slot.
    - A yellow **Retired** box is after its name.
  - **Notes:**

### WORKFORCE-06: Someone Moves to Another Feature Team From Next Month

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as WORKFORCE-05.

**Preconditions:** None beyond WORKFORCE-05.

- [ ] `8D15` Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab.
  - **Expected:** The page is headed **Capacity**, with **Feature teams** chosen in its tabs.
  - **Notes:**

- [ ] `D898` Select **Feature team** in the Group by menu.
  - **Expected:** The rows are grouped under the feature teams, then **No feature team**.
  - **Notes:**

- [ ] `359F` Scroll to the 'Identity' group, and note the name in its first row: the mover.
  - **Expected:** The mover's cell in the current month names 'Identity'.
  - **Notes:**

- [ ] `D3ED` Select **None** in the Group by menu.
  - **Expected:** There are no group names.
  - **Notes:**

- [ ] `1780` Type the mover's name in the search box.
  - **Expected:** Only the mover's row is listed.
  - **Notes:**

- [ ] `4BE6` Select the mover's cell in the month after the current month.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `C94D` Press Delete.
  - **Expected:**
    - The row is tinted faint yellow.
    - In the cell and every cell to its right, 'Identity' has a hollow yellow dot before it, and is struck through.
    - The current month's cell names 'Identity', with no dot.
  - **Notes:**

- [ ] `327F` Press Enter.
  - **Expected:** The team list opens.
  - **Notes:**

- [ ] `704F` Type `Pay`, then press Tab.
  - **Expected:**
    - The team list closes.
    - From the cell selected on, each cell names 'Payments core' after a hollow yellow dot.
    - A light green Live row is under the mover's row.
  - **Notes:**

- [ ] `CA86` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

### WORKFORCE-07: The Move Is Approved and Shows on Capacity

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as WORKFORCE-06. Step `2A2C` signs in as another account.

**Preconditions:** WORKFORCE-06 done, with the mover's name noted.

- [ ] `2A2C` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `4DCA` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `9AF6` Clear the search box, and type the mover's name.
  - **Expected:** Two rows are listed, each with **Type** "Feature team" and a tick box:
    - one whose **Record** reads 'Payments core', whose **What changes** adds the mover to **Members**
    - one whose **Record** reads 'Identity'
  - **Notes:**

- [ ] `F1BE` Tick the 'Payments core' row's tick box.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `4801` Tick the 'Identity' row's tick box.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 2 drafts…**.
  - **Notes:**

- [ ] `BD38` Select **Approve 2 drafts…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 2 drafts?" opens.
  - **Notes:**

- [ ] `9AD4` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notification says "Approved 2 drafts."
  - **Notes:**

- [ ] `7E0F` Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab.
  - **Expected:** The page is headed **Capacity**, with **Feature teams** chosen in its tabs.
  - **Notes:**

- [ ] `5EC1` Type the mover's name in the search box.
  - **Expected:**
    - Only the mover's row is listed, with no tint.
    - The current month's cell names 'Identity', with no dot.
    - The next month's cell names 'Payments core', with no dot.
  - **Notes:**

### WORKFORCE-08: A Planning Setting Is Changed and Approved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from WORKFORCE-07. Step `A2F8` signs in as another account.

**Preconditions:** Signed in with this account.

- [ ] `D402` Select the **Planning settings** page in the left-hand menu.
  - **Expected:** Under **Working time**, **Hours a day** reads "8".
  - **Notes:**

- [ ] `13B0` Select "8" beside **Hours a day**.
  - **Expected:** A field in place of "8" holds "8".
  - **Notes:**

- [ ] `71EA` Replace the value with `4`, and press Enter.
  - **Expected:**
    - **Hours a day** reads "4" after a hollow yellow dot.
    - Under it, "8" follows a green dot.
  - **Notes:**

- [ ] `F41C` Run Publish.
  - **Expected:** The mark before "4" is filled yellow.
  - **Notes:**

- [ ] `A2F8` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `BE47` Select the **Planning settings** page in the left-hand menu.
  - **Expected:** **Hours a day** reads "4" after a yellow dot.
  - **Notes:**

- [ ] `B555` Select the **⋯** button at the right of the **Hours a day** row.
  - **Expected:**
    - A menu headed **Planning settings** opens.
    - Under the heading, a yellow dot and "Draft: changed".
    - Under that, "Hours a day from 8 to 4, by Engineering Operations Manager".
    - Then **Approve…** and **Reject…**, with no **Discard draft**.
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
