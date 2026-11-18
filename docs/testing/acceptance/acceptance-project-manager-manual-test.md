---
title: "Manual Test: Acceptance, Project Manager"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-a-project-manager.md", "docs/product/roles.md"]
last_updated: "2026-11-17"
---

# Manual Test: Acceptance, Project Manager

## Scope

Verifies the workflows of [Working as a Project Manager](../../help/working-as-a-project-manager.md) on the seed data: keeping a project on track with a new milestone, its scope history and its features, approved by a Product Manager; seeing who works on what in Feature assignments and Capacity; approving and rejecting others' drafts; and keeping a view of one project's milestones.

## Test Environment

As [Manual Test Basics](../manual-test-basics.md#test-environment) sets out, with a browser window at least 1,440 pixels wide.

## Test Accounts

As [Manual Test Basics](../manual-test-basics.md#test-accounts) sets out, this test uses:

- **Project Manager:** `project.manager@fathom.test`
- **Product Manager:** `product.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](../manual-test-basics.md#start-fathom), [Reset the Database](../manual-test-basics.md#reset-the-database) and [Publish](../manual-test-basics.md#publish).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Publish button, the Group by menu, the details button, the side panel, the mode switch and seeded dates. This test adds:

- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20300315`.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### PROJECT-01: A Project Is Kept on Track

**Account:** Project Manager, `project.manager@fathom.test`; the first test case. Step `0DC4` signs in as another account.

**Preconditions:** Reset the Database run. Signed in with this account.

- [ ] `E13F` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** tab is chosen.
  - **Notes:**

- [ ] `AA7F` Select the details button at the right of the **Name** cell of 'Depot Operations'.
  - **Expected:**
    - The side panel is headed 'Depot Operations'.
    - Under **Milestones** are 'Depot pilot', dated before today, and 'All depots live', dated after it.
    - Each is followed by ", customer delivery".
    - **Next delivery** shows the date of 'All depots live'.
  - **Notes:**

- [ ] `CECC` Select **Add milestone**.
  - **Expected:** A dialog titled "New milestone" opens.
  - **Notes:**

- [ ] `1B84` Type `Fictional site survey` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `823B` Type `20300315` in **Date**.
  - **Expected:** **Date** shows the date typed.
  - **Notes:**

- [ ] `B1A3` Leave **Customer delivery** unticked, and select **Add milestone** in the dialog.
  - **Expected:**
    - Under **Milestones**, a hollow yellow dot before `Fictional site survey`.
    - Under it, the date for `2030-03-15`.
  - **Notes:**

- [ ] `B474` Read **Scope history**, at the end of the panel.
  - **Expected:**
    - 'Parts Lookup', 'Barcode Scanning' and 'Work Order Sync' are listed.
    - Each is followed in grey by "Added" and a date.
  - **Notes:**

- [ ] `34CA` Open the **⋯** menu of 'Depot Operations' in the table, and select **Show features**.
  - **Expected:**
    - The **Features** page opens, showing only 'Parts Lookup', 'Barcode Scanning' and 'Work Order Sync'.
    - A pill above the table reads "Projects: P-2017 Depot Operations".
  - **Notes:**

- [ ] `D014` Select the **×** on the pill.
  - **Expected:** The pill is gone, and the table lists every feature.
  - **Notes:**

- [ ] `C73C` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `0DC4` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Product Manager".
  - **Notes:**

- [ ] `5A60` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `34BB` Type `Fictional site survey` in the search box.
  - **Expected:** One row is shown:
    - **Record** reads `Fictional site survey of P-2017 Depot Operations`.
    - **Change** reads "Added".
    - **Type** reads "Milestone".
    - **Made by** reads "Project Manager as Project Manager".
  - **Notes:**

- [ ] `6F30` Tick that row's tick box.
  - **Expected:**
    - The tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `B83C` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `C3C3` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 1 draft."
  - **Notes:**

### PROJECT-02: Who Works on What, by Month and by Team

**Account:** Project Manager, `project.manager@fathom.test`, changed from PROJECT-01.

**Preconditions:** Signed in with this account.

- [ ] `369C` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:**
    - The page is headed **Feature assignments**.
    - **Group by: Manager** is above the table.
    - The table has a **Person** column on the left.
    - The table has a column for each month, and the current month is the first beside the **Person** column.
  - **Notes:**

- [ ] `E06A` Select **Feature team** in the Group by menu.
  - **Expected:**
    - The rows are grouped under the feature teams in order of name, then **No feature team**.
    - Each label names a feature team, in a box tinted with the team's colour, or grey for a team with none.
  - **Notes:**

- [ ] `1D47` Select the **Capacity** page in the left-hand menu.
  - **Expected:**
    - The mode switch has **People** chosen.
    - The current month is the first month beside the **Person** column.
  - **Notes:**

- [ ] `5181` Select **Feature team** in the Group by menu.
  - **Expected:**
    - It is grouped by **Feature team**.
    - Cells list features, each on a line of its own with its percentage at the right, such as "50%".
  - **Notes:**

- [ ] `7E22` Search for `Alvena Sanford`, and read her cell in the current month's column.
  - **Expected:**
    - The cell lists 'Barcode Scanning' with "10%" and 'Signature Capture' with "90%", each on a line of its own.
    - Under them, a last line reads "Total", with "100%" at the right.
    - A thin line above it sets it off.
  - **Notes:**

- [ ] `FBBB` Clear the search box, and type `Blaise Gislason`. Read his cell in the current month's column.
  - **Expected:**
    - The cell lists 'Depot Operations' with "25%" and 'Transit Displays' with "100%".
    - Its last line reads "Over", with "125%" at the right.
    - "Over" and its percentage are red and bold.
  - **Notes:**

- [ ] `4A9E` Clear the search box, and type `Anahi Bins`. Read her cell in the current month's column.
  - **Expected:**
    - The cell lists 'Depot Operations' with "50%".
    - Its last line reads "Under", with "50%" at the right.
    - "Under" and its percentage are grey.
  - **Notes:**

### PROJECT-03: Others' Drafts Are Approved and Rejected

**Account:** Project Manager, `project.manager@fathom.test`, the same as PROJECT-02.

**Preconditions:** None beyond PROJECT-02.

- [ ] `AF7A` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `59A3` Type `Search and discovery` in the search box.
  - **Expected:** One row is shown, with a tick box:
    - **Record** reads 'Search and discovery'.
    - **What changes** sets **Name** from "Search" to "Search and discovery".
    - **Type** reads "Feature team".
    - **Made by** reads "Engineering Operations Manager".
  - **Notes:**

- [ ] `BE6F` Tick that row's tick box.
  - **Expected:**
    - The tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `9D51` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `D32E` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 1 draft."
  - **Notes:**

- [ ] `4CBA` Type `Simone Jean` in the search box.
  - **Expected:** One row is shown, with a tick box:
    - **Record** reads 'Simone Jean'.
    - **What changes** changes **Manager** from "Viktoria Holmberg" to "Silje Holm-Schrøder".
    - **Type** reads "Person".
    - **Made by** reads "Engineering Operations Manager".
  - **Notes:**

- [ ] `F85F` Tick that row's tick box.
  - **Expected:**
    - The tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `ADC8` Select **Reject…** at the right of the page's heading.
  - **Expected:**
    - A dialog titled "Reject 1 draft?" opens.
    - It has a **Reason** box.
  - **Notes:**

- [ ] `5B0B` Type `Fictional reason: wait for the new team plan.` in **Reason**.
  - **Expected:** **Reason** shows what was typed.
  - **Notes:**

- [ ] `5B7D` Select **Reject**.
  - **Expected:**
    - A notice reads "Rejected 1 draft."
    - The table reads "No matching drafts".
  - **Notes:**

- [ ] `75EA` Select **All drafts** beside the page's title.
  - **Expected:** One row is shown, of 'Simone Jean':
    - It starts with a red dot in a ring.
    - **State** reads "Rejected".
    - **Reason** reads "Fictional reason: wait for the new team plan."
  - **Notes:**

- [ ] `C6D2` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `9B65` Choose **Feature teams** in the teams switch.
  - **Expected:**
    - A team's first card names 'Search and discovery'.
    - No dot is before the name.
  - **Notes:**

### PROJECT-04: A Project Manager Keeps a View of One Project's Milestones

**Account:** Project Manager, `project.manager@fathom.test`, the same as PROJECT-03.

**Preconditions:** None beyond PROJECT-03.

- [ ] `404D` Select the **Projects** page in the left-hand menu, then the **Milestones** tab.
  - **Expected:** The **Milestones** tab is chosen, with no view applied.
  - **Notes:**

- [ ] `C19F` Select the **Project** header, then **Filter…**.
  - **Expected:** The choices include 'P-2017 Depot Operations'.
  - **Notes:**

- [ ] `078B` Tick 'P-2017 Depot Operations'.
  - **Expected:** 'P-2017 Depot Operations' is the only choice ticked.
  - **Notes:**

- [ ] `F30F` Press Esc.
  - **Expected:**
    - Only milestones of 'Depot Operations' are listed, such as 'Depot pilot'.
    - `Fictional site survey`, approved in PROJECT-01, is among them.
  - **Notes:**

- [ ] `F2B5` Open the Views menu, and select **Save view…**.
  - **Expected:**
    - A dialog titled "Save view" shows **Name**.
    - Under **Includes**, **Filter** reads "Project: P-2017 Depot Operations".
    - It offers no choice about sharing.
  - **Notes:**

- [ ] `6CAE` Type `Fictional depot milestones` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `B2F7` Select **Save view**.
  - **Expected:**
    - The dialog closes.
    - The Views button reads `Fictional depot milestones`.
  - **Notes:**

- [ ] `ACCD` Select the **Projects** tab.
  - **Expected:**
    - Every project is listed.
    - The **Views** button reads **Views**.
  - **Notes:**

- [ ] `7E76` Select the **Milestones** tab.
  - **Expected:** The **Milestones** tab is chosen.
  - **Notes:**

- [ ] `B134` Open the Views menu, and select `Fictional depot milestones` under **My views**.
  - **Expected:** Only milestones of 'Depot Operations' are listed.
  - **Notes:**

**Afterwards:** Run Reset the Database.
