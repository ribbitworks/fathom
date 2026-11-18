---
title: "Manual Test: Acceptance, Engineering Director"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-an-engineering-director.md", "docs/product/roles.md"]
last_updated: "2026-11-17"
---

# Manual Test: Acceptance, Engineering Director

## Scope

Verifies the workflows of [Working as an Engineering Director](../../help/working-as-an-engineering-director.md) on the seed data: filling a planned hire and approving the director's own drafts, changing a reporting line from an earlier date and seeing it on the org chart, changing a detail's class, sharing a view of People that another account sees until it is no longer shared, and sharing views of the schedules, of Features and of the Proposals tab.

## Test Environment

As [Manual Test Basics](../manual-test-basics.md#test-environment) sets out, with:

- A browser window at least 1,440 pixels wide.
- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

As [Manual Test Basics](../manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Director:** `engineering.director@fathom.test`
- **Engineering Manager:** `engineering.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](../manual-test-basics.md#start-fathom), [Reset the Database](../manual-test-basics.md#reset-the-database) and [Publish](../manual-test-basics.md#publish).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **Months from today:** the steps name months by where they fall from the current month: **last month** is the one before it, and the **month before last month** the one before that. The examples after "such as" are for a run in November 2026.
- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20301231`.
- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### DIRECTOR-01: A Planned Hire Is Filled and Approved

**Account:** Engineering Director, `engineering.director@fathom.test`; the first test case.

**Preconditions:** Reset the Database run. Signed in with this account. **People** page open from the left-hand menu, with no filters.

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

- [ ] `BAC3` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `02A5` Type `Backend engineer 2` in the search box.
  - **Expected:** A row whose **Record** reads 'Backend engineer 2' is listed, with a tick box.
  - **Notes:**

- [ ] `BCDC` Tick that row's tick box.
  - **Expected:**
    - The tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `36FF` Select **Approve 1 draft…** at the right of the page's heading.
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
    - It reads 'Ashgrove' in **Site**.
  - **Notes:**

- [ ] `6FB2` Search for `Backend engineer 2`.
  - **Expected:** No row named 'Backend engineer 2' is shown.
  - **Notes:**

### DIRECTOR-02: A Reporting Line Is Changed From an Earlier Date

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DIRECTOR-01.

**Preconditions:** **People** page open, with no filters.

- [ ] `84D1` Search for `Candice Swift`.
  - **Expected:** Her **Manager** cell reads 'Lorenza Thiel'.
  - **Notes:**

- [ ] `B78A` Select her **Manager** cell, press Enter, type `Max`, and choose 'Max Munk'.
  - **Expected:** The cell reads 'Max Munk', with a hollow yellow dot before it.
  - **Notes:**

- [ ] `6F4A` Select her **Manager assigned** cell, type the first day of last month, such as `20261001`, and press Enter.
  - **Expected:** The cell reads the date typed, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `AE1B` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `FAD3` Select **Show levels**, then **All levels**.
  - **Expected:** On the card for 'Candice Swift' under 'Max Munk', a hollow yellow dot comes before her name.
  - **Notes:**

- [ ] `1C01` Select the left arrow twice.
  - **Expected:**
    - The **Date** box shows the first day of the month before last month.
    - The card for 'Candice Swift' is under 'Lorenza Thiel'.
    - There is no card for her under 'Max Munk'.
  - **Notes:**

- [ ] `5CE3` Select **Today**.
  - **Expected:** The card for 'Candice Swift' is under 'Max Munk' again.
  - **Notes:**

- [ ] `FE1D` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `9D2D` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `628C` Type `Candice Swift` in the search box.
  - **Expected:**
    - One row is shown, whose **Record** reads 'Candice Swift'.
    - Its **What changes** changes **Manager** from "Lorenza Thiel" to "Max Munk".
    - The row has a tick box.
  - **Notes:**

- [ ] `A951` Tick that row's tick box.
  - **Expected:**
    - The tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `03F9` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `77F0` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 1 draft."
  - **Notes:**

### DIRECTOR-03: A Detail's Class Is Changed

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DIRECTOR-02.

**Preconditions:** None beyond DIRECTOR-02.

- [ ] `38C9` Select the **Data classes** page under **Administration** in the left-hand menu.
  - **Expected:**
    - Three sections follow the heading: **Built-in details**, **Columns** and **Lists**.
    - Most rows end with a **Change class…** button.
  - **Notes:**

- [ ] `97B4` Select **Change class…** on the **End date** row.
  - **Expected:**
    - A dialog titled "Change the class of End date" opens.
    - **Personal** is chosen.
  - **Notes:**

- [ ] `F0D4` Select **General**.
  - **Expected:** **General** is chosen.
  - **Notes:**

- [ ] `EAFA` Select **Change**.
  - **Expected:**
    - The dialog closes.
    - **End date**'s class is an open eye, then **General**.
    - No notification shows, and the Publish button doesn't appear.
  - **Notes:**

- [ ] `FAC4` Select the **Access history** page in the left-hand menu.
  - **Expected:** The newest entry reads "Engineering Director changed End date's class: from Personal to General", with a yellow dot before it.
  - **Notes:**

### DIRECTOR-04: A Shared View Is Seen by Others Until It Stops Being Shared

**Account:** Engineering Director, `engineering.director@fathom.test`, in the main browser, the same as DIRECTOR-03. The second browser signs in as another account in step `F3B1`.

**Preconditions:** **People** page open from the left-hand menu, with no view applied.

- [ ] `36B5` Search for `el`.
  - **Expected:** Each row listed has `el` in one of its cells, in capitals or not.
  - **Notes:**

- [ ] `C002` Open the Views menu, and select **Save view…**.
  - **Expected:** The dialog shows a checkbox, **Share with everyone who sees this page**, not ticked, below **Name**.
  - **Notes:**

- [ ] `85D9` Type `Fictional hiring` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `CFEB` Tick **Share with everyone who sees this page**.
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
    - **Stop sharing current view** is offered.
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
  - **Expected:** **Rename…**, **Delete view** and **Stop sharing current view** are not offered.
  - **Notes:**

- [ ] `99E4` In the main browser, press Esc.
  - **Expected:** The Views menu closes.
  - **Notes:**

- [ ] `3B91` In the main browser, open the Views menu, and select **Stop sharing current view**.
  - **Expected:**
    - A notice says "Stopped sharing the Fictional hiring view."
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

### DIRECTOR-05: Shared Views of the Plan

**Account:** Engineering Director, `engineering.director@fathom.test`, in the main browser, the same as DIRECTOR-04. The second browser is still signed in as the Engineering Manager.

**Preconditions:** None beyond DIRECTOR-04.

- [ ] `9B78` Select the **Releases** page in the left-hand menu, then the **Schedules** tab.
  - **Expected:** The **Schedules** tab is chosen, with no view applied.
  - **Notes:**

- [ ] `1069` Type `Platform` in the search box.
  - **Expected:** The table lists only 'Platform'.
  - **Notes:**

- [ ] `E050` Open the Views menu, and select **Save view…**.
  - **Expected:**
    - A dialog titled "Save view" shows **Name**.
    - Below it is a checkbox, **Share with everyone who sees this page**, not ticked.
  - **Notes:**

- [ ] `F359` Type `Fictional platform` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `57B0` Tick **Share with everyone who sees this page**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `AA82` Select **Save view**.
  - **Expected:**
    - The dialog closes.
    - The Views button reads `Fictional platform`.
  - **Notes:**

- [ ] `E5B9` In the second browser, select the **Releases** page in the left-hand menu, then the **Schedules** tab.
  - **Expected:** The **Schedules** tab is chosen.
  - **Notes:**

- [ ] `74B0` In the second browser, open the Views menu, and select `Fictional platform` under **Shared views**.
  - **Expected:**
    - The search box shows `Platform`.
    - The table lists only 'Platform'.
  - **Notes:**

- [ ] `D43E` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens, showing the table, with no view applied.
  - **Notes:**

- [ ] `2C7B` Select **Group by: Cycle** above the table, then **Status** under **Group by**.
  - **Expected:** The headings name feature statuses, such as **In progress**.
  - **Notes:**

- [ ] `9B19` Open the Views menu, and select **Save view…**.
  - **Expected:** Under **Includes**, **Group by** reads "Status".
  - **Notes:**

- [ ] `4A1F` Type `Fictional by status` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `1D44` Tick **Share with everyone who sees this page**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `1CCD` Select **Save view**.
  - **Expected:** The Views button reads `Fictional by status`.
  - **Notes:**

- [ ] `D738` In the second browser, select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens, with its headings naming cycles.
  - **Notes:**

- [ ] `D6DB` In the second browser, open the Views menu, and select `Fictional by status` under **Shared views**.
  - **Expected:** The headings name feature statuses, such as **In progress**.
  - **Notes:**

- [ ] `7D8F` Select the **Projects** page in the left-hand menu, then the **Proposals** tab.
  - **Expected:** The **Proposals** tab is chosen, with no view applied.
  - **Notes:**

- [ ] `20FA` Type `Harbour` in the search box.
  - **Expected:** 'Harbour Cranes Upgrade' is listed.
  - **Notes:**

- [ ] `46B7` Open the Views menu, and select **Save view…**.
  - **Expected:** Under **Includes**, **Search** reads “Harbour”.
  - **Notes:**

- [ ] `5D3A` Type `Fictional harbour bids` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `C609` Tick **Share with everyone who sees this page**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `E0E8` Select **Save view**.
  - **Expected:** The Views button reads `Fictional harbour bids`.
  - **Notes:**

- [ ] `8CF5` In the second browser, select the **Projects** page in the left-hand menu, then the **Proposals** tab.
  - **Expected:** The **Proposals** tab is chosen.
  - **Notes:**

- [ ] `BB2A` In the second browser, open the Views menu, and select `Fictional harbour bids` under **Shared views**.
  - **Expected:**
    - The search box shows `Harbour`.
    - 'Harbour Cranes Upgrade' is listed.
  - **Notes:**

**Afterwards:** Run Reset the Database.
