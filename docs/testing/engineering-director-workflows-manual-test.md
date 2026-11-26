---
title: "Manual Test: Engineering Director Workflows"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-an-engineering-director.md", "docs/product/roles.md"]
last_updated: "2026-11-25"
---

# Manual Test: Engineering Director Workflows

## Scope

Verifies the jobs of [Working as an Engineering Director](../help/working-as-an-engineering-director.md) on the seed data, each draft approved by the director:

- Planning the hiring: marking a planned hire approved to hire, and filling one.
- Changing reporting lines: a new manager from an earlier date, checked on the org chart, and someone leaving.
- Choosing who sees Personal and Confidential data: changing a detail's class.
- Approving drafts, the director's own included, and rejecting one with a reason.

[Workforce Administrator](workforce-administrator-workflows-manual-test.md) verifies requesting a hire.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with a browser window at least 1,440 pixels wide.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Director:** `engineering.director@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database) and [Publish](manual-test-basics.md#publish).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **Months from today:** the steps name months by where they fall from the current month: **last month** is the one before it, and the **month before last month** the one before that. The examples after "such as" are for a run in November 2026.
- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20301231`.
- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### DIRECTOR-01: A Planned Hire Is Filled, and the Director Approves Their Own Draft

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

- [ ] `94F2` Clear the search box, and type `Fictional new starter`.
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

- [ ] `8672` Type `Candice` in the finder, and choose 'Candice Swift'.
  - **Expected:**
    - The chart centres on the card for 'Candice Swift', with a blue ring around it.
    - Her card is joined by a line to the card for 'Max Munk' above it.
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

- [ ] `628C` Clear the search box, and type `Candice Swift`.
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
  - **Expected:** The newest entry reads "Engineering Director changed End date's class: from Personal to General", and ends in a grey **Worth checking** box.
  - **Notes:**

### DIRECTOR-04: A Shared View Is Seen by Others Until It Stops Being Shared

Removed: sharing a view and stopping it is checked in [VIEW-03](saved-views-manual-test.md#view-03-a-view-is-shared-and-then-stops-being-shared) in Saved Views.

### DIRECTOR-05: Shared Views of the Plan

Removed: a shared view of the plan is checked in [VIEW-13](saved-views-manual-test.md#view-13-a-view-on-features-is-shared-by-its-table-and-board) in Saved Views.

### DIRECTOR-06: A Planned Hire Is Marked Approved to Hire

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DIRECTOR-03.

**Preconditions:** Select the **People** page in the left-hand menu, with no filters.

- [ ] `90F5` Clear the search box, and type `Mobile developer`.
  - **Expected:**
    - Among the rows listed is a hire row named 'Mobile developer'.
    - It reads 'REQ-2055' in **ID**.
    - It reads "Request to hire" in **State**.
  - **Notes:**

- [ ] `2384` Select that row's **State** cell, press Enter, choose **Approved to hire**, and press Enter.
  - **Expected:**
    - The cell reads "Approved to hire", with a hollow yellow dot before it.
    - The row is faintly yellow.
  - **Notes:**

- [ ] `0ED9` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `AB8D` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `687D` Clear the search box, and type `REQ-2055`.
  - **Expected:**
    - One row is shown, whose **Record** reads 'Mobile developer'.
    - Its **What changes** changes **State** from "Request to hire" to "Approved to hire".
    - The row has a tick box.
  - **Notes:**

- [ ] `7188` Tick that row's tick box.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `373F` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `E3AE` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 1 draft."
  - **Notes:**

- [ ] `A10E` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `A0C2` Clear the search box, and type `REQ-2055`.
  - **Expected:**
    - Only the row of 'Mobile developer' is shown, with no dot.
    - It reads "Approved to hire" in **State**.
    - A **Fill** button shows in its **Name** cell.
  - **Notes:**

### DIRECTOR-07: Someone Leaving Is Recorded

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DIRECTOR-06.

**Preconditions:** **People** page open, with no filters.

- [ ] `A36F` Clear the search box, and type `Tanushree Patel-Singh`.
  - **Expected:** A row for 'Tanushree Patel-Singh' is listed.
  - **Notes:**

- [ ] `219B` Select her **End** cell, press Enter, type `20301231`, and press Enter.
  - **Expected:**
    - The cell reads the date typed, with a hollow yellow dot before it.
    - The row is faintly yellow.
  - **Notes:**

- [ ] `BD88` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `934F` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `7DD9` Clear the search box, and type `Tanushree`.
  - **Expected:** One row is shown, whose **Record** reads 'Tanushree Patel-Singh', with a tick box.
  - **Notes:**

- [ ] `4631` Tick that row's tick box.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `64C5` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `3528` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 1 draft."
    - The table reads "No matching drafts".
  - **Notes:**

### DIRECTOR-08: A Draft Is Rejected With a Reason

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DIRECTOR-07.

**Preconditions:** **Drafts** page open, with **To decide** chosen beside the page's title.

- [ ] `B773` Clear the search box, and type `Simone Jean`.
  - **Expected:** One row is shown, with a tick box:
    - **Record** reads 'Simone Jean'.
    - **What changes** changes **Manager** from "Viktoria Holmberg" to "Silje Holm-Schrøder".
    - **Made by** reads "Engineering Operations Manager".
  - **Notes:**

- [ ] `13A0` Tick that row's tick box.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `1D3F` Select **Reject…** at the right of the page's heading.
  - **Expected:**
    - A dialog titled "Reject 1 draft?" opens.
    - It has a **Reason** box.
  - **Notes:**

- [ ] `1094` Type `Fictional reason: keep the reporting line until the review.` in **Reason**.
  - **Expected:** **Reason** shows what was typed.
  - **Notes:**

- [ ] `5F1D` Select **Reject**.
  - **Expected:**
    - A notice reads "Rejected 1 draft."
    - The table reads "No matching drafts".
  - **Notes:**

- [ ] `3A7D` Select **All drafts** beside the page's title.
  - **Expected:** One row is shown, of 'Simone Jean':
    - It starts with a red dot in a ring.
    - **State** reads "Rejected".
    - **Reason** reads "Fictional reason: keep the reporting line until the review."
  - **Notes:**

**Afterwards:** Run Reset the Database.
