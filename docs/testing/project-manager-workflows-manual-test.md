---
title: "Manual Test: Project Manager Workflows"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-a-project-manager.md", "docs/product/roles.md"]
last_updated: "2026-11-25"
---

# Manual Test: Project Manager Workflows

## Scope

Verifies the workflows of [Working as a Project Manager](../help/working-as-a-project-manager.md) on the seed data:

- Tracking proposals: adding one, choosing its features and changing its status.
- Keeping a project on track: a new milestone, approved by a Product Manager, its scope history and its features.
- Moving a feature to another cycle and a milestone to another date.
- Making a release with a note, approved by a Product Manager.
- Seeing who works on what in Capacity's Feature teams and Allocations tabs.
- Checking, approving and rejecting others' drafts.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A browser window at least 1,440 pixels wide.
- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Project Manager:** `project.manager@fathom.test`
- **Product Manager:** `product.manager@fathom.test`
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as "Second Engineering Operations Manager"

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Publish button, the Group by menu, the details button, the side panel, tabs and seeded dates. This test adds:

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

- [ ] `34CA` Open the **⋯** menu of 'Depot Operations' in the table, and select **Show on Features**.
  - **Expected:**
    - The **Features** page opens, showing only 'Parts Lookup', 'Barcode Scanning' and 'Work Order Sync'.
    - A pill above the table reads "Projects: P-2017 Depot Operations".
  - **Notes:**

- [ ] `D014` Select the **×** on the pill.
  - **Expected:**
    - The pill is gone.
    - The table lists every feature.
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

- [ ] `369C` Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab.
  - **Expected:**
    - The page is headed **Capacity**, with **Feature teams** chosen in its tabs.
    - **Group by** is above the table, naming no grouping.
    - The table has a **Person** column on the left.
    - The table has a column for each month; the current month is the second beside the **Person** column, after last month.
  - **Notes:**

- [ ] `E06A` Select **Feature team** in the Group by menu.
  - **Expected:**
    - The rows are grouped under the feature teams in order of name, then **No feature team**.
    - Each team's name, in the headings and the cells, follows a small square in its colour; a team with no colour has no square.
  - **Notes:**

- [ ] `1D47` Select the **Allocations** tab.
  - **Expected:**
    - **Allocations** is chosen in the **Capacity** page's tabs.
    - The current month is the second month beside the **Person** column, after last month.
  - **Notes:**

- [ ] `5181` Select **Feature team** in the Group by menu.
  - **Expected:**
    - It is grouped by **Feature team**.
    - Cells list features, each on a line of its own with its percentage at the right, such as "50%".
  - **Notes:**

- [ ] `7E22` Search for `Alvena Sanford`, and read her cell in the current month's column.
  - **Expected:**
    - The cell lists 'Barcode Scanning' with "10%" and 'Signature Capture' with "90%", each on a line of its own.
    - There is no line under them.
  - **Notes:**

- [ ] `FBBB` Clear the search box, and type `Blaise Gislason`. Read his cell in the current month's column.
  - **Expected:**
    - The cell lists 'Depot Operations' with "25%" and 'Transit Displays' with "100%".
    - Its last line reads "Over", with "+25%" at the right.
    - "Over" and "+25%" are red and bold.
  - **Notes:**

- [ ] `4A9E` Clear the search box, and type `Anahi Bins`. Read her cell in the current month's column.
  - **Expected:**
    - The cell lists 'Depot Operations' with "50%".
    - Its last line reads "Under", with "−50%" at the right.
    - "Under" and "−50%" are red and bold.
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

- [ ] `FD04` Point at that row, and select the details button that shows at the right of its **Record** cell.
  - **Expected:** A details panel opens beside the table:
    - Its title is a yellow dot, then 'Search and discovery'.
    - **State** reads "Waiting".
    - **What changes** sets **Name** from "Search" to "Search and discovery".
    - **Made by** reads "Engineering Operations Manager".
  - **Notes:**

- [ ] `98DC` Press Esc.
  - **Expected:** The details panel closes.
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

- [ ] `4CBA` Clear the search box, and type `Simone Jean`.
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

Removed: keeping a view is checked in [VIEW-01](saved-views-manual-test.md#view-01-a-personal-view-is-kept-to-its-maker) in Saved Views.

### PROJECT-05: A Proposal Is Added, Given a Feature and Won

**Account:** Project Manager, `project.manager@fathom.test`, the same as PROJECT-03.

**Preconditions:** None beyond PROJECT-03.

- [ ] `ED9C` Select the **Projects** page in the left-hand menu, then the **Proposals** tab.
  - **Expected:** The table lists the proposals.
  - **Notes:**

- [ ] `24F3` Select **New proposal**.
  - **Expected:** The side panel opens, headed **New proposal**.
  - **Notes:**

- [ ] `57DD` Type `Fictional Lighthouse Proposal` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `668E` Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before `Fictional Lighthouse Proposal`.
    - **Status** reads "Open".
  - **Notes:**

- [ ] `EEEA` Search for `Fictional Lighthouse`.
  - **Expected:** Only the row of `Fictional Lighthouse Proposal` is listed.
  - **Notes:**

- [ ] `6F07` Select its **Features** cell, and press Enter.
  - **Expected:** A list of features opens, with a search box.
  - **Notes:**

- [ ] `A903` Type `Scheduler`, and press Enter to pick 'Scheduler API'.
  - **Expected:** 'Scheduler API' has a tick.
  - **Notes:**

- [ ] `F3AA` Press Enter.
  - **Expected:** The **Features** cell names 'Scheduler API', with a hollow yellow dot before it.
  - **Notes:**

- [ ] `5A89` Select its **Status** cell, press Enter, choose **Won**, and press Enter.
  - **Expected:** The **Status** cell reads "Won".
  - **Notes:**

- [ ] `AB6F` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

### PROJECT-06: A Feature and a Milestone Move When Dates Change

**Account:** Project Manager, `project.manager@fathom.test`, the same as PROJECT-05.

**Preconditions:** None beyond PROJECT-05.

- [ ] `294B` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `E166` Search for `Scheduler API`.
  - **Expected:** Only the row of 'Scheduler API' is listed.
  - **Notes:**

- [ ] `F5F8` Select its **Target cycle** cell, press Enter, choose the cycle listed after the one it shows, and press Enter.
  - **Expected:**
    - **Target cycle** reads the cycle chosen, with a hollow yellow dot before it.
    - **Release** names 'Harbor 3'.
  - **Notes:**

- [ ] `4D28` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `F5B9` Select the **Projects** page in the left-hand menu, then the **Projects** tab.
  - **Expected:** The table lists the projects.
  - **Notes:**

- [ ] `BC4D` Select the details button at the right of the **Name** cell of 'Depot Operations'.
  - **Expected:** Under **Milestones**, `Fictional site survey` shows the date for `2030-03-15`, with no dot.
  - **Notes:**

- [ ] `5DEB` Open the **⋯** menu of `Fictional site survey` under **Milestones**, and select **Edit…**.
  - **Expected:** A dialog opens, with `Fictional site survey` in **Name**.
  - **Notes:**

- [ ] `2CDA` Clear **Date**, and type `20300415`.
  - **Expected:** **Date** shows the date typed.
  - **Notes:**

- [ ] `9E47` Select **Save**.
  - **Expected:**
    - The dialog closes.
    - Under **Milestones**, `Fictional site survey` shows the date for `2030-04-15`.
    - A hollow yellow dot is before `Fictional site survey`.
  - **Notes:**

- [ ] `4F1A` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

### PROJECT-07: A Release Is Made, With a Note

**Account:** Project Manager, `project.manager@fathom.test`, in the main browser, the same as PROJECT-06. Steps `131E` and `047C` act in the second browser. Step `3DB5` signs in as another account in the main browser.

**Preconditions:** Signed in with this account in the main browser. **Releases** page open from the left-hand menu.

- [ ] `131E` In the second browser, sign in as the Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`.
  - **Expected:** The top bar shows the Publish button.
  - **Notes:**

- [ ] `047C` In the second browser, run Discard the Unpublished Changes.
  - **Expected:**
    - A notice says "Discarded" followed by the number of changes.
    - The Publish button is gone.
  - **Notes:**

- [ ] `076F` In the main browser, reload the page.
  - **Expected:** The **Releases** page shows again.
  - **Notes:**

- [ ] `38DB` Select **New release**.
  - **Expected:** A dialog titled "New release" opens, whose first field is **Schedule**.
  - **Notes:**

- [ ] `1C70` Choose 'Platform' in **Schedule**.
  - **Expected:** **Name**, **First cycle**, **Last cycle**, an empty **Ships on** and **Colour** follow it.
  - **Notes:**

- [ ] `B1A8` Type `Fictional Harbor 4` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `1FE0` Choose the last cycle in the list in **First cycle**.
  - **Expected:** **First cycle** shows the cycle chosen.
  - **Notes:**

- [ ] `D146` Choose the last cycle in the list in **Last cycle**.
  - **Expected:** The empty **Ships on** field shows, in grey, that cycle's last day, then "end of" and the cycle's name in brackets.
  - **Notes:**

- [ ] `C642` Select **Make release**.
  - **Expected:**
    - A notification says "Drafted the new release."
    - The side panel is headed with a hollow yellow dot before `Fictional Harbor 4`.
  - **Notes:**

- [ ] `67E5` Select the **⋯** button at the right of the first cell of the row for `Fictional Harbor 4`, then **Add note…**.
  - **Expected:**
    - A panel titled "Note for Fictional Harbor 4" opens beside the release's details.
    - **Editor** is chosen.
  - **Notes:**

- [ ] `C123` Type `Fictional ferry timetables`.
  - **Expected:** The note shows what was typed.
  - **Notes:**

- [ ] `58FA` Select **Save**.
  - **Expected:**
    - A notification says "Drafted the note on Fictional Harbor 4."
    - The note's panel closes.
    - The **Note** row in the release's details reads `Fictional ferry timetables`.
  - **Notes:**

- [ ] `FF3E` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `3DB5` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Product Manager".
  - **Notes:**

- [ ] `119A` Select the **Releases** page in the left-hand menu.
  - **Expected:** The **Releases** tab shows, with a row for `Fictional Harbor 4` whose **Schedule** reads 'Platform'.
  - **Notes:**

- [ ] `5E58` Select the **⋯** button at the right of the first cell of the row for `Fictional Harbor 4`, then **Approve draft…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `B441` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - `Fictional Harbor 4` has no dot.
  - **Notes:**

- [ ] `CBD5` Select the details button at the right of the first cell of the row for `Fictional Harbor 4`.
  - **Expected:** The **Note** row reads `Fictional ferry timetables`.
  - **Notes:**

**Afterwards:** Run Reset the Database.
