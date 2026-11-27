---
title: "Manual Test: Product Manager Workflows"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-a-product-manager.md", "docs/product/roles.md"]
last_updated: "2026-11-27"
---

# Manual Test: Product Manager Workflows

## Scope

Verifies the workflows of [Working as a Product Manager](../help/working-as-a-product-manager.md) on the seed data:

- Planning a feature for a cycle and a month, and adding a column to Features.
- Keeping customers, proposals, projects and milestones current.
- Choosing a project's features and taking one off a proposal with a reason, as the scope history shows.
- Approving and rejecting others' drafts on the Drafts page and from the Features table, with the Product Manager's own approved by a Project Manager.
- Following a rejected and resubmitted draft in the change history.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with a browser window at least 1,440 pixels wide.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`, holding the Feature Lead role, its default, and the Engineering Manager role

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database) and [Publish](manual-test-basics.md#publish).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, a row's slot, Draft rows and Live rows, the Publish button, the Draft menu, the details button, the side panel and seeded dates. This test adds:

- **Next quarter's cycle:** the 'Platform' schedule's cycle for the quarter after the one today is in. The examples after "such as" are for a run in November 2026.
- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20300315`.

## Test Cases

Run the test cases in order, in about 35 minutes. Start with Start Fathom, then Reset the Database. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### PRODUCT-01: Customers, a Proposal and a Project With Milestones Are Added

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Reset the Database run. Signed out.

- [ ] `7FC5` Sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The **Overview** page opens, reading "Acting as Product Manager".
  - **Notes:**

- [ ] `0CEA` Select the **Projects** link beside **Keep Projects and Proposals Current**.
  - **Expected:** The **Projects** page opens.
  - **Notes:**

- [ ] `8F09` Select the **Customers** tab, then **New customer**.
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

- [ ] `90B4` Select the **Proposals** tab, then **New proposal**.
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

- [ ] `53F7` Select the change button in the **Status** row, and choose **Won**.
  - **Expected:** **Status** shows "Won".
  - **Notes:**

- [ ] `80B1` Select the **Projects** tab, then **New project**.
  - **Expected:** The side panel opens, headed **New project**.
  - **Notes:**

- [ ] `428B` Type `Fictional Harbour Lights` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `4B05` Type `FHL-1` in **Project ID**.
  - **Expected:** **Project ID** shows what was typed.
  - **Notes:**

- [ ] `33A4` Select the change button in the **Owner** row, and pick any person. Write the owner's name in the notes.
  - **Expected:** **Owner** shows the name picked.
  - **Notes:**

- [ ] `962A` Select the change button in the **Customers** row, and pick `Fictional Ferry Co-op`.
  - **Expected:** **Customers** shows `Fictional Ferry Co-op`.
  - **Notes:**

- [ ] `9C9C` Select the change button in the **Proposals** row, and pick `Fictional Ferry Proposal`.
  - **Expected:** **Proposals** shows `Fictional Ferry Proposal`.
  - **Notes:**

- [ ] `73F0` Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before `Fictional Harbour Lights`.
    - **First milestone**, **Last milestone** and **Next delivery** read "None".
    - Under **Milestones**, "None" and an **Add milestone** button.
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
    - **First milestone**, **Last milestone** and **Next delivery** each show the date for `2030-03-15`.
    - The table's row for `Fictional Harbour Lights` shows the date for `2030-03-15` as **First milestone**, **Last milestone** and **Next delivery**.
  - **Notes:**

- [ ] `8CE5` Run Publish.
  - **Expected:** The dots before the project and `Pilot` are now filled yellow.
  - **Notes:**

### PRODUCT-02: A Project Manager Approves the Project With the Drafts It Depends On

**Account:** Project Manager, `project.manager@fathom.test`, changed from PRODUCT-01.

**Preconditions:** PRODUCT-01 done. Signed in with this account. **Projects** page open, on the **Projects** tab.

- [ ] `2F40` Open the ⋯ menu of `Fictional Harbour Lights`, and select **Approve draft…**.
  - **Expected:**
    - A dialog asks to approve the drafts.
    - Under "Also approves the drafts these depend on:", it lists "the proposal Fictional Ferry Proposal" and "the customer Fictional Ferry Co-op".
  - **Notes:**

- [ ] `D1D9` Select **Approve** in the dialog.
  - **Expected:** `Fictional Harbour Lights` has no dot.
  - **Notes:**

### PRODUCT-03: A Feature Is Planned for a Cycle and a Month

**Account:** Product Manager, `product.manager@fathom.test`, changed from PRODUCT-02. Step `C828` signs in as another account.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

- [ ] `4C9D` Select **New feature**.
  - **Expected:**
    - The **New feature** panel opens beside the table.
    - Labels are at the left of each row, under the headings **Details** and **Columns**.
  - **Notes:**

- [ ] `87FB` Type `Fictional Atlas` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `E267` Select the change button in the **Target cycle** row, and choose next quarter's cycle, such as **Platform: 27.1**.
  - **Expected:** **Target cycle** shows the cycle chosen.
  - **Notes:**

- [ ] `3C7F` Type `203003` in **Needed by**.
  - **Expected:** **Needed by** shows `2030-03`.
  - **Notes:**

- [ ] `D041` Press Enter.
  - **Expected:** The feature's details show beside the table, headed with a hollow yellow dot before `Fictional Atlas`.
  - **Notes:**

- [ ] `D82C` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `C828` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `08A4` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `A988` Open the ⋯ menu of `Fictional Atlas`, and select **Approve draft…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `49CE` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - `Fictional Atlas` has no dot.
  - **Notes:**

### PRODUCT-04: Features Are Tied to a Project and Taken Off a Proposal

**Account:** Product Manager, `product.manager@fathom.test`, changed from PRODUCT-03.

**Preconditions:** PRODUCT-02 and PRODUCT-03 done. Signed in with this account.

- [ ] `2B30` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens, on the **Projects** tab.
  - **Notes:**

- [ ] `829F` Select the **Features** cell of `Fictional Harbour Lights`, and press Enter.
  - **Expected:** A list of features opens, with a search box.
  - **Notes:**

- [ ] `5CA9` Type `Atlas`, and press Enter to pick `Fictional Atlas`.
  - **Expected:** `Fictional Atlas` has a tick.
  - **Notes:**

- [ ] `D603` Press Enter.
  - **Expected:** The **Features** cell names `Fictional Atlas`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `067B` Select the details button at the right of the **Name** cell of `Fictional Harbour Lights`.
  - **Expected:**
    - The side panel is headed `Fictional Harbour Lights`.
    - Under **Scope history**, `Fictional Atlas` has a hollow yellow dot before it.
    - It is followed in grey by "Added" and today's date.
  - **Notes:**

- [ ] `14C7` Select the **Proposals** tab.
  - **Expected:** The table lists the proposals.
  - **Notes:**

- [ ] `344D` Select the **Features** cell of 'Harbour Cranes Upgrade', and press Enter.
  - **Expected:** A list of features opens, with 'Audit Export' and 'Offline Sync' picked.
  - **Notes:**

- [ ] `CF09` Unpick 'Audit Export'.
  - **Expected:** 'Audit Export' has no tick.
  - **Notes:**

- [ ] `7E49` Press Enter.
  - **Expected:** The **Features** cell names, from left to right:
    - a hollow yellow dot, then 'Audit Export', struck through
    - 'Offline Sync'
  - **Notes:**

- [ ] `28F2` Select **Show details** in the **⋯** menu of 'Harbour Cranes Upgrade'.
  - **Expected:**
    - Under **Scope history**, the first row has a hollow yellow dot, then 'Audit Export'.
    - Its next line reads "Removed" and today's date, in grey.
    - A change button is at the row's right.
  - **Notes:**

- [ ] `291F` Select the change button at the right of the first row under **Scope history**.
  - **Expected:**
    - An empty box opens under "Removed" and today's date.
    - The cursor is in the box.
  - **Notes:**

- [ ] `836B` Type `Fictional reason: not in this phase`, and press Enter.
  - **Expected:**
    - The box closes.
    - The first row's last line reads "Reason: Fictional reason: not in this phase".
  - **Notes:**

- [ ] `FA37` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

### PRODUCT-05: A Release Is Made, With a Note

Covered by [PROJECT-07](project-manager-workflows-manual-test.md#project-07-a-release-is-made-with-a-note) in Project Manager Workflows.

### PRODUCT-06: A Feature Lead's Change Is Rejected With a Reason on the Drafts Page

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from PRODUCT-04. Step `5AB9` signs in as another account.

**Preconditions:** Signed in with this account, acting as **Feature Lead**. **Features** page open.

- [ ] `189B` In the row 'Partner Portal', select the **Status** cell, press Enter, choose **Planned**, and press Enter.
  - **Expected:**
    - The cell reads "Planned", with a hollow yellow dot before it.
    - The row is faintly yellow.
    - Its **Feature team** cell shows "No feature team" in red, with no box.
    - A Live row under it reads "Possible".
  - **Notes:**

- [ ] `67D2` Run Publish.
  - **Expected:** The dot before "Planned" in the 'Partner Portal' row is filled yellow.
  - **Notes:**

- [ ] `5AB9` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Product Manager".
  - **Notes:**

- [ ] `D73D` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `8CE8` Type `Partner Portal` in the search box.
  - **Expected:** One row is shown, with a tick box:
    - **Record** reads 'Partner Portal'.
    - **State** reads "Waiting".
    - **Made by** reads "Feature Lead".
  - **Notes:**

- [ ] `2A64` Tick that row's tick box.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `7DE1` Select **Reject…** at the right of the page's heading.
  - **Expected:**
    - A dialog titled "Reject 1 draft?" opens.
    - It has a **Reason** box.
  - **Notes:**

- [ ] `EC9E` Type `Fictional reason: wait for the customer day.` in **Reason**.
  - **Expected:** **Reason** shows what was typed.
  - **Notes:**

- [ ] `55A4` Select **Reject**.
  - **Expected:**
    - A notification says "Rejected 1 draft."
    - The table reads "No matching drafts".
  - **Notes:**

### PRODUCT-07: A Rejected Change Is Resubmitted and Approved

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from PRODUCT-06. Step `4F03` signs in as another account.

**Preconditions:** PRODUCT-06 done. Signed in with this account, acting as **Feature Lead**. **Features** page open from the left-hand menu.

- [ ] `1ADD` Open the ⋯ menu of 'Partner Portal'.
  - **Expected:**
    - In the 'Partner Portal' row, "Planned" has a red dot in a ring before it.
    - The row is faintly red.
    - The menu's draft section is headed by a red dot in a ring and "Rejected".
    - Under the heading, it reads "Reason: Fictional reason: wait for the customer day."
    - The menu offers **Resubmit** and **Discard draft**.
  - **Notes:**

- [ ] `6A10` Select **Resubmit**.
  - **Expected:**
    - The dot before "Planned" is solid yellow.
    - The row is faintly yellow.
  - **Notes:**

- [ ] `4F03` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Product Manager".
  - **Notes:**

- [ ] `3F3E` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `65C0` Search for `Partner Portal`.
  - **Expected:** One row is shown, with a tick box:
    - **Record** reads 'Partner Portal'.
    - **State** reads "Waiting".
    - **Type** reads "Feature".
    - **Made by** reads "Feature Lead".
  - **Notes:**

- [ ] `DDD3` Tick that row's tick box.
  - **Expected:**
    - The tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `F240` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `AD8D` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - The table reads "No matching drafts".
  - **Notes:**

### PRODUCT-08: The Change History Tells How a Draft Went

**Account:** Product Manager, `product.manager@fathom.test`, the same as PRODUCT-07.

**Preconditions:** PRODUCT-07 done. Signed in with this account.

- [ ] `ABF7` Select the **Change history** page in the left-hand menu.
  - **Expected:** The **Change history** page opens.
  - **Notes:**

- [ ] `E6DA` Search for `Partner Portal`.
  - **Expected:** The entries, newest first, say that:
    - "Product Manager" approved changes to 'Partner Portal'.
    - "Feature Lead" sent the draft of 'Partner Portal' for approval again.
    - "Product Manager" rejected the draft of 'Partner Portal', with the **Reason** "Fictional reason: wait for the customer day."
    - "Feature Lead" drafted changes to 'Partner Portal', changing **Status** from "Possible" to "Planned".
  - **Notes:**

**Afterwards:** Run Reset the Database.

### PRODUCT-09: Someone Who Has Not Started Is Listed Only for Those Who See Personal Details

Proved by automated tests in `apps/server/src/people-access.test.ts`.

### PRODUCT-10: A Feature Lead's Change Is Approved From the Features Table

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from PRODUCT-08, signed in again after Reset the Database. Step `A8DE` signs in as another account.

**Preconditions:** Reset the Database run after PRODUCT-08. Signed in with this account, acting as **Feature Lead**. **Features** page open from the left-hand menu.

- [ ] `BCA0` Search for `Partner Portal`.
  - **Expected:** Only the row of 'Partner Portal' is listed, reading "High" in **Priority**.
  - **Notes:**

- [ ] `3A3E` Select its **Priority** cell, press Enter, choose **Medium**, and press Enter.
  - **Expected:**
    - The cell reads "Medium", with a hollow yellow dot before it.
    - The row is faintly yellow.
    - A Live row under it reads "High" in **Priority**.
  - **Notes:**

- [ ] `EB5B` Run Publish.
  - **Expected:** The dot before "Medium" is filled yellow.
  - **Notes:**

- [ ] `A8DE` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Product Manager".
  - **Notes:**

- [ ] `42A0` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `9BDB` Search for `Partner Portal`.
  - **Expected:** The 'Partner Portal' row reads "Medium" in **Priority**, with a yellow dot before it.
  - **Notes:**

- [ ] `D189` Open the Draft menu.
  - **Expected:** The menu offers **Approve 1 draft…**.
  - **Notes:**

- [ ] `C093` Select **Approve 1 draft…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `33A1` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - 'Partner Portal' reads "Medium" in **Priority**, with no dot and no Live row.
  - **Notes:**

### PRODUCT-11: A Column Is Added to Features and Filled In

**Account:** Product Manager, `product.manager@fathom.test`, the same as PRODUCT-10.

**Preconditions:** **Features** page open.

- [ ] `29D5` Select **New column**, at the right of the page's heading.
  - **Expected:** The **New column** dialog opens.
  - **Notes:**

- [ ] `C27B` Type `Fictional Reach` in **Name**.
  - **Expected:** **Name** holds `Fictional Reach`.
  - **Notes:**

- [ ] `E1FB` Choose **Number** in **Type**.
  - **Expected:** **List** and **Several choices** are gone.
  - **Notes:**

- [ ] `FE86` Select **Add column**.
  - **Expected:**
    - The dialog closes.
    - A `Fictional Reach` column is at the right end of the table.
    - A hollow yellow dot is before `Fictional Reach` in its header.
  - **Notes:**

- [ ] `AA60` Search for `Report Builder`.
  - **Expected:** Only the row of 'Report Builder' is listed.
  - **Notes:**

- [ ] `D13D` Select its `Fictional Reach` cell, type `40`, and press Enter.
  - **Expected:** The cell reads "40", with a hollow yellow dot before it.
  - **Notes:**

- [ ] `292D` Run Publish.
  - **Expected:** The dot before `Fictional Reach` in its header is filled yellow.
  - **Notes:**

**Afterwards:** Run Reset the Database.
