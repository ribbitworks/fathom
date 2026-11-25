---
title: "Manual Test: Product Manager Workflows"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-a-product-manager.md", "docs/product/roles.md"]
last_updated: "2026-11-24"
---

# Manual Test: Product Manager Workflows

## Scope

Verifies the workflows of [Working as a Product Manager](../help/working-as-a-product-manager.md) on the seed data:

- Keeping customers, proposals, projects and milestones current.
- Planning a feature for a cycle, a team and a month.
- Choosing a project's features and taking one off a proposal with a reason, as the scope history shows.
- Making a release with a note.
- Approving and rejecting others' drafts, each sent on to an approver where the role needs one.

It also checks that the Product Manager doesn't see someone who has not started.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A browser window at least 1,440 pixels wide.
- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`, holding the Feature Lead role, its default, and the Engineering Manager role
- **Engineering Director:** `engineering.director@fathom.test`
- **Engineering Manager:** `engineering.manager@fathom.test`
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as "Second Engineering Operations Manager"

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, a row's slot, Draft rows and Live rows, the Publish button, the Draft menu, the details button, the side panel and seeded dates. This test adds:

- **Next quarter's cycle:** the 'Platform' schedule's cycle for the quarter after the one today is in. The examples after "such as" are for a run in November 2026.
- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20300315`.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### PRODUCT-01: Customers, a Proposal and a Project With Milestones Are Added

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Reset the Database run. Signed in with this account. **Projects** page open from the left-hand menu.

- [ ] `8F09` Select the **Customers** tab.
  - **Expected:** The **Customers** tab is selected.
  - **Notes:**

- [ ] `2E2F` Select **New customer**.
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

- [ ] `70AF` Select the **Proposals** tab.
  - **Expected:** The **Proposals** tab is selected.
  - **Notes:**

- [ ] `90B4` Select **New proposal**.
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

- [ ] `6AB9` Select the **Projects** tab.
  - **Expected:** The **Projects** tab is selected.
  - **Notes:**

- [ ] `80B1` Select **New project**.
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
  - **Notes:**

- [ ] `A3C4` Select **Add milestone**.
  - **Expected:** A dialog titled "New milestone" opens.
  - **Notes:**

- [ ] `886C` Type `Go live` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `D5E8` Type `20300630` in **Date**.
  - **Expected:** **Date** shows the date typed.
  - **Notes:**

- [ ] `43B4` Leave **Customer delivery** unticked, and select **Add milestone** in the dialog.
  - **Expected:**
    - `Go live` is listed after `Pilot`.
    - **First milestone** shows the date for `2030-03-15`.
    - **Last milestone** shows the date for `2030-06-30`.
    - **Next delivery** shows the date for `2030-03-15`.
    - The table's row for `Fictional Harbour Lights` shows the date for `2030-03-15` as **First milestone**, for `2030-06-30` as **Last milestone** and for `2030-03-15` as **Next delivery**.
  - **Notes:**

- [ ] `8CE5` Run Publish.
  - **Expected:** The dots before the project and both milestones are now filled yellow.
  - **Notes:**

### PRODUCT-02: A Project Manager Approves the Project and Its Milestones

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

- [ ] `150E` Select the **Milestones** tab.
  - **Expected:**
    - The **Milestones** tab is selected.
    - The table of milestones is under the tab.
  - **Notes:**

- [ ] `FA29` Type `Fictional Harbour Lights` in the search box.
  - **Expected:** `Pilot` and `Go live` are listed, each with a yellow dot in its slot.
  - **Notes:**

- [ ] `76BA` Open the Draft menu.
  - **Expected:** The menu offers **Approve 2 drafts…**.
  - **Notes:**

- [ ] `5DBB` Select **Approve 2 drafts…**.
  - **Expected:** A dialog titled "Approve 2 drafts?" opens.
  - **Notes:**

- [ ] `22C1` Select **Approve** in the dialog.
  - **Expected:**
    - `Pilot` and `Go live` have no dots.
    - Each has `Fictional Harbour Lights` under **Project**, with `FHL-1` in grey before it.
  - **Notes:**

**Afterwards:** Select the **Projects** tab.

### PRODUCT-03: A Feature Is Planned for a Cycle and a Team

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

- [ ] `EF83` Select the change button in the **Feature team** row, and choose 'Mobile apps'.
  - **Expected:** **Feature team** shows 'Mobile apps'.
  - **Notes:**

- [ ] `3C7F` Type `203003` in **Needed by**, and press Enter.
  - **Expected:** **Needed by** shows `2030-03`.
  - **Notes:**

- [ ] `D041` Select **Add** at the foot of the **New feature** panel.
  - **Expected:** The feature's details show beside the table, headed with a hollow yellow dot before `Fictional Atlas`.
  - **Notes:**

- [ ] `D82C` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `9D64` Reload the page.
  - **Expected:**
    - `Fictional Atlas` reads next quarter's cycle in **Target cycle**, such as **Platform: 27.1**.
    - Its row has a filled yellow dot in its slot.
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
    - A notice reads "Approved 1 draft."
    - `Fictional Atlas` has no dot.
  - **Notes:**

### PRODUCT-04: Features Are Tied to a Project and Taken Off a Proposal

**Account:** Product Manager, `product.manager@fathom.test`, changed from PRODUCT-03. Step `40DC` signs in as another account.

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

- [ ] `D603` Press Esc.
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

- [ ] `7E49` Press Esc.
  - **Expected:** The **Features** cell names 'Offline Sync' alone.
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

- [ ] `40DC` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `891F` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens, on the **Projects** tab.
  - **Notes:**

- [ ] `DD3B` Open the **⋯** menu of `Fictional Harbour Lights`, and select **Approve draft…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `F637` Select **Approve** in the dialog.
  - **Expected:** `Fictional Harbour Lights` has no dot.
  - **Notes:**

- [ ] `26F3` Select the **Proposals** tab.
  - **Expected:** The table lists the proposals.
  - **Notes:**

- [ ] `7C72` Open the **⋯** menu of 'Harbour Cranes Upgrade', and select **Approve draft…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `9CF1` Select **Approve** in the dialog.
  - **Expected:**
    - 'Harbour Cranes Upgrade' has no dot.
    - Its **Features** cell names 'Offline Sync' alone.
  - **Notes:**

- [ ] `D4AB` Select the **Projects** tab.
  - **Expected:** The table lists the projects.
  - **Notes:**

- [ ] `8A70` Select **Show features** in the ⋯ menu of `Fictional Harbour Lights`.
  - **Expected:**
    - The **Features** page opens showing only `Fictional Atlas`.
    - A pill above the table reads "Projects: FHL-1 Fictional Harbour Lights".
  - **Notes:**

- [ ] `57DA` Select the **×** on the pill.
  - **Expected:**
    - The pill is gone.
    - The table lists every feature.
  - **Notes:**

### PRODUCT-05: A Release Is Made, With a Note

**Account:** Product Manager, `product.manager@fathom.test`, in the main browser, changed from PRODUCT-04. Steps `131E` and `047C` act in the second browser. Step `3DB5` signs in as another account in the main browser.

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

- [ ] `F083` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `A09D` Select **Group by** above the table, then **Release**.
  - **Expected:**
    - The release headings, such as **Platform: Harbor 1**, are each followed by a comma, "ships" and a date.
    - `Fictional Atlas` is under the heading **Platform: Not released yet**.
    - The last heading is **Later**.
  - **Notes:**

- [ ] `3DB5` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
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

### PRODUCT-06: A Feature Lead's Change Is Rejected With a Reason

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from PRODUCT-05. Step `5AB9` signs in as another account.

**Preconditions:** Signed in with this account, acting as **Feature Lead**. **Features** page open.

- [ ] `189B` In the row 'Partner Portal', select the **Status** cell, press Enter, choose **Planned**, and press Enter.
  - **Expected:**
    - The cell reads "Planned", with a hollow yellow dot before it.
    - The row is faintly yellow.
    - Its **Feature team** cell shows **No team** in red, with no box.
    - A Live row under it reads "Possible".
  - **Notes:**

- [ ] `67D2` Run Publish.
  - **Expected:** The dot before "Planned" in the 'Partner Portal' row is filled yellow.
  - **Notes:**

- [ ] `5AB9` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Product Manager".
  - **Notes:**

- [ ] `FBED` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `312A` Open the ⋯ menu of 'Partner Portal'.
  - **Expected:**
    - The menu names the change to **Status**.
    - It offers **Approve draft…** and **Reject draft…**.
  - **Notes:**

- [ ] `F5B3` Select **Reject draft…**.
  - **Expected:**
    - A dialog titled "Reject 1 draft?" opens.
    - It has a **Reason** box.
  - **Notes:**

- [ ] `EC9E` Type `Fictional reason: wait for the customer day.` in **Reason**.
  - **Expected:** **Reason** shows what was typed.
  - **Notes:**

- [ ] `55A4` Select **Reject**.
  - **Expected:**
    - A notice reads "Rejected 1 draft."
    - In the 'Partner Portal' row, "Planned" has a red dot in a ring before it.
    - The row is faintly red.
  - **Notes:**

### PRODUCT-07: A Rejected Change Is Resubmitted and Approved

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from PRODUCT-06. Step `4F03` signs in as another account.

**Preconditions:** PRODUCT-06 done. Signed in with this account, acting as **Feature Lead**. **Features** page open.

- [ ] `1ADD` Open the ⋯ menu of 'Partner Portal'.
  - **Expected:**
    - The menu shows a red dot in a ring, then "Rejected".
    - Under it, "Reason: Fictional reason: wait for the customer day."
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

- [ ] `65C0` Type `Partner Portal` in the search box.
  - **Expected:** One row is shown, with a tick box:
    - **Record** reads 'Partner Portal'.
    - **State** reads "Waiting".
    - **Type** reads "Feature".
    - **Made by** reads "Feature Lead as Feature Lead".
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
    - A notice reads "Approved 1 draft."
    - The table reads "No matching drafts".
  - **Notes:**

- [ ] `AFA2` Select **Features**.
  - **Expected:**
    - 'Partner Portal' reads "Planned" in **Status**.
    - It has no dot.
  - **Notes:**

### PRODUCT-08: The Change History Tells How a Draft Went

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from PRODUCT-07.

**Preconditions:** PRODUCT-07 done. Signed in with this account.

- [ ] `ABF7` Select the **Change history** page in the left-hand menu.
  - **Expected:** The **Change history** page opens.
  - **Notes:**

- [ ] `E6DA` Type `Partner Portal` in the search box.
  - **Expected:** The entries, newest first, say that:
    - "Product Manager" approved the changes to 'Partner Portal'
    - "Feature Lead" sent its draft for approval again
    - "Product Manager" rejected its draft, with the reason "Fictional reason: wait for the customer day."
    - "Feature Lead" drafted changing **Status** from "Possible" to "Planned"
  - **Notes:**

**Afterwards:** Run Reset the Database.

### PRODUCT-09: Someone Who Has Not Started Is Listed Only for Those Who See Personal Details

**Account:** Product Manager, `product.manager@fathom.test`, changed from PRODUCT-08, signed in again after Reset the Database.

**Preconditions:** Reset the Database run after PRODUCT-08. Signed in with this account. **People** page open from the left-hand menu.

- [ ] `4D1A` Search for `Chatura Abbott`.
  - **Expected:**
    - No row is shown.
    - The table has no **Start** or **End** column.
  - **Notes:**

An account that sees Personal details does see her, as [EXECUTIVE-03](executive-workflows-manual-test.md#executive-03-an-executive-sees-people-and-administration-without-changing-them) checks.
