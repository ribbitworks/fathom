---
title: "Manual Test: Drafts of Projects, Proposals, Customers and Milestones"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/projects.md"]
last_updated: "2026-11-27"
---

# Manual Test: Drafts of Projects, Proposals, Customers and Milestones

## Scope

Verifies adding a customer, a proposal and a project with milestones on the Projects page, the dates milestones give a project, and approving those drafts, then changing a milestone, removing the project and approving the removal.

[Projects, Proposals, Customers and Milestones](projects-manual-test.md) verifies the tabs as a Team Member sees them, editing in a table and a side panel, and the features projects and proposals need.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database) and [Publish](manual-test-basics.md#publish).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Draft menu, the ⋯ menu, the side panel and dates. This test adds:

- **Tabs:** **Projects**, **Proposals**, **Customers** and **Milestones**, just after the page's heading, on the same line. The tab chosen is underlined.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### PROJ-02: The Product Manager Adds a Customer

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Projects** page open from the left-hand menu.

- [ ] `DFAE` Select the **Customers** tab.
  - **Expected:** The table of customers shows.
  - **Notes:**

- [ ] `7F45` Select **New customer** at the top right.
  - **Expected:**
    - The side panel opens, headed **New customer**.
    - It has a **Name** box, a **Description** box and **Notes**.
    - **Cancel** and **Add** are at its foot.
  - **Notes:**

- [ ] `11B3` Type `Testing Customer` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `4BC5` Select **Add**.
  - **Expected:**
    - The side panel is now headed `Testing Customer`.
    - A hollow yellow dot is before the heading.
    - The table has a row for it.
    - The row has a hollow yellow dot in its slot.
  - **Notes:**

### PROJ-03: The Product Manager Adds a Proposal and Changes Its Status

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-02.

**Preconditions:** Signed in with this account. Run after PROJ-02.

- [ ] `A477` Select the **Proposals** tab.
  - **Expected:** The table of proposals shows.
  - **Notes:**

- [ ] `8B61` Select **New proposal**.
  - **Expected:**
    - The side panel opens, headed **New proposal**.
    - It has **Name**, **Proposal ID**, **Link**, **Owner**, **Customers**, **Status** and **Features**.
    - **Status** already reads "Open".
  - **Notes:**

- [ ] `84A9` Type `Testing Proposal` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `880E` Select **Add**.
  - **Expected:**
    - The side panel is headed `Testing Proposal`.
    - A hollow yellow dot is before the heading.
    - **Status** reads "Open".
  - **Notes:**

- [ ] `0B36` In the table, select the **Status** cell of `Testing Proposal`, press Enter, choose **Won** and press Enter.
  - **Expected:**
    - The cell reads "Won".
    - The row's slot still has its hollow yellow dot.
    - Pointing at the dot shows "Draft: added".
    - The side panel shows **Status** as "Won".
  - **Notes:**

### PROJ-04: The Product Manager Adds a Project With Milestones

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-03.

**Preconditions:** Signed in with this account. Run after PROJ-03.

- [ ] `C43B` Select the **Projects** tab.
  - **Expected:** The table of projects shows.
  - **Notes:**

- [ ] `7B51` Select **New project**.
  - **Expected:**
    - The side panel opens, headed **New project**.
    - It has **Name**, **Project ID**, **Owner**, **Customers**, **Proposals** and **Features**.
  - **Notes:**

- [ ] `CFC3` Type `Testing Project` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `FA46` Type `TP-1` in **Project ID**.
  - **Expected:** **Project ID** shows what was typed.
  - **Notes:**

- [ ] `F9B9` Select the change button in the **Owner** row, and pick any person. Write the name down in the notes.
  - **Expected:** **Owner** shows the name picked.
  - **Notes:**

- [ ] `10A4` Select the change button in the **Customers** row, and pick `Testing Customer`.
  - **Expected:** **Customers** shows `Testing Customer`.
  - **Notes:**

- [ ] `28B5` Select the change button in the **Proposals** row, and pick `Testing Proposal`.
  - **Expected:** **Proposals** shows `Testing Proposal`.
  - **Notes:**

- [ ] `82C4` Select **Add**.
  - **Expected:**
    - The side panel is headed `Testing Project`.
    - A hollow yellow dot is before the heading.
    - It shows the person picked as **Owner**, `Testing Customer` and `Testing Proposal`.
    - **First milestone**, **Last milestone** and **Next delivery** read "None".
    - Under **Milestones** are "None" and an **Add milestone** button.
    - The table has a row for it.
  - **Notes:**

- [ ] `C4CE` Select **Add milestone**.
  - **Expected:** A dialog titled **New milestone** opens.
  - **Notes:**

- [ ] `FE60` Type `Pilot` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `15B1` Type `20300315` in **Date**.
  - **Expected:** **Date** reads "2030-03-15".
  - **Notes:**

- [ ] `3C91` Tick **Customer delivery**.
  - **Expected:** The box is ticked.
  - **Notes:**

- [ ] `F1AB` Select **Add milestone** in the dialog.
  - **Expected:**
    - The dialog closes.
    - Under **Milestones**, `Pilot` shows on one line.
    - A hollow yellow dot is before `Pilot`.
    - Under `Pilot`, the date for `2030-03-15` and ", customer delivery".
    - The **⋯** button is at the right of the panel.
  - **Notes:**

- [ ] `20EA` Select **Add milestone**.
  - **Expected:** A dialog titled **New milestone** opens.
  - **Notes:**

- [ ] `FE19` Type `Go live` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `2E32` Type `20300630` in **Date**.
  - **Expected:** **Date** reads "2030-06-30".
  - **Notes:**

- [ ] `2ED8` Select **Add milestone** in the dialog, leaving **Customer delivery** unticked.
  - **Expected:**
    - `Go live` is listed after `Pilot`.
    - In the panel, **First milestone** shows the date for `2030-03-15`.
    - **Last milestone** shows the date for `2030-06-30`.
    - **Next delivery** shows the date for `2030-03-15`.
    - In the table's row for `Testing Project`, **First milestone** shows the date for `2030-03-15`, **Last milestone** the date for `2030-06-30` and **Next delivery** the date for `2030-03-15`.
  - **Notes:**

- [ ] `65A1` Run Publish.
  - **Expected:** The dots before the customer, proposal, project and both milestones are now solid yellow.
  - **Notes:**

### PROJ-05: The Milestones Tab and a Project's Milestones

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-04.

**Preconditions:** Signed in with this account. Run after PROJ-04. **Projects** tab open.

- [ ] `66E9` Select the **Milestones** tab.
  - **Expected:**
    - Every project's milestones are listed, among them `Pilot` and `Go live`.
    - `Pilot` and `Go live` each have `Testing Project` under **Project**, after `TP-1` in grey.
    - `Pilot`'s **Customer delivery** box is ticked.
  - **Notes:**

- [ ] `FD18` Select the **Projects** tab.
  - **Expected:** The table of projects shows.
  - **Notes:**

- [ ] `47EF` In the ⋯ menu of `Testing Project`, select **Show on Milestones**.
  - **Expected:**
    - The **Milestones** tab opens.
    - It shows only `Pilot` and `Go live`.
    - A pill above the table reads "Project: TP-1 Testing Project".
    - Beside the pill, "2 of" is followed by the number of all milestones.
  - **Notes:**

- [ ] `10CE` Select **New milestone**.
  - **Expected:**
    - The side panel opens, headed **New milestone**.
    - **Project** already reads "TP-1 Testing Project".
  - **Notes:**

- [ ] `03D0` Type `Sign-off` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `101B` Type `20300901` in **Date**.
  - **Expected:** **Date** reads "2030-09-01" as it is typed.
  - **Notes:**

- [ ] `37E1` Select **Add**.
  - **Expected:**
    - The side panel closes.
    - `Sign-off` is added.
    - It has a hollow yellow dot in its slot.
  - **Notes:**

- [ ] `456E` Select the **×** on the "Project: TP-1 Testing Project" pill.
  - **Expected:** Every project's milestones show again.
  - **Notes:**

- [ ] `2DD8` In the ⋯ menu of `Sign-off`, select **Show project**.
  - **Expected:**
    - The **Projects** tab opens.
    - `Testing Project`'s side panel shows.
    - In the side panel, **Last milestone** now shows the date for `2030-09-01`.
    - `Sign-off` is listed after `Go live`.
  - **Notes:**

- [ ] `BA19` Run Publish.
  - **Expected:** `Sign-off`'s dot is now solid yellow.
  - **Notes:**

### PROJ-06: The Project Manager Approves the Drafts

**Account:** Project Manager, `project.manager@fathom.test`, changed from PROJ-05.

**Preconditions:** Signed in with this account. Run after PROJ-05.

- [ ] `725A` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `36AF` Type `Testing` in the search box.
  - **Expected:**
    - There is a row whose **Record** reads each of these, in any order:
      - `Testing Customer`, with **Type** "Customer"
      - `Testing Proposal`, with **Type** "Proposal"
      - `TP-1 Testing Project`, with **Type** "Project"
      - `Pilot of TP-1 Testing Project`, `Go live of TP-1 Testing Project` and `Sign-off of TP-1 Testing Project`, each with **Type** "Milestone"
    - Each row's **Made by** reads "Product Manager".
    - Each row has a tick box.
  - **Notes:**

- [ ] `318B` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens on the **Projects** tab.
  - **Notes:**

- [ ] `B5D5` Select the **Customers** tab.
  - **Expected:** The table of customers shows.
  - **Notes:**

- [ ] `FAB6` In the ⋯ menu of `Testing Customer`, select **Approve draft…**.
  - **Expected:** A dialog asks "Approve 1 draft?"
  - **Notes:**

- [ ] `0E73` Select **Approve** in the dialog.
  - **Expected:**
    - The dot goes.
    - `Testing Customer` is live.
  - **Notes:**

- [ ] `46BD` Select the **Projects** tab.
  - **Expected:** The table of projects shows.
  - **Notes:**

- [ ] `FB16` In the Draft menu, select **Approve** followed by the number of waiting drafts, such as **Approve 6 drafts…**.
  - **Expected:**
    - A dialog says how many drafts it approves.
    - Under "Also approves the drafts these depend on:", it lists "the proposal Testing Proposal".
  - **Notes:**

- [ ] `C59C` Select **Approve** in the dialog.
  - **Expected:** `Testing Project` has no dot.
  - **Notes:**

- [ ] `E300` Open **Show details** of `Testing Project`.
  - **Expected:**
    - The side panel shows `Pilot`, `Go live` and `Sign-off` under **Milestones**.
    - Each still has a yellow dot before it.
  - **Notes:**

- [ ] `A4F0` Select the **Milestones** tab.
  - **Expected:** The table of milestones shows.
  - **Notes:**

- [ ] `2AF6` In the Draft menu, select **Approve** followed by the number of waiting drafts.
  - **Expected:** A dialog says how many drafts it approves.
  - **Notes:**

- [ ] `C9D6` Select **Approve** in the dialog.
  - **Expected:** `Pilot`, `Go live` and `Sign-off` have no dots.
  - **Notes:**

- [ ] `8EC1` Select the **Projects** tab.
  - **Expected:** In the row for `Testing Project`, **Last milestone** shows the date for `2030-09-01`.
  - **Notes:**

### PROJ-07: The Product Manager Changes a Milestone, Then Removes the Project

**Account:** Product Manager, `product.manager@fathom.test`, changed from PROJ-06.

**Preconditions:** Signed in with this account. Run after PROJ-06. **Projects** tab open.

- [ ] `6DF6` Open **Show details** of `Testing Project`.
  - **Expected:**
    - The side panel shows `Testing Project`.
    - `Sign-off` is under **Milestones**.
  - **Notes:**

- [ ] `A100` In the ⋯ menu of `Sign-off`, select **Edit…**.
  - **Expected:** The **Edit milestone** dialog opens.
  - **Notes:**

- [ ] `324D` Change **Date** to `20301015`.
  - **Expected:** **Date** reads "2030-10-15".
  - **Notes:**

- [ ] `9BE4` Select **Save**.
  - **Expected:**
    - A hollow yellow dot is before `Sign-off`.
    - **Last milestone** shows the date for `2030-10-15`.
    - A hollow yellow dot is before that date.
    - Under it is the date for `2030-09-01`.
    - A green dot is before the date for `2030-09-01`.
  - **Notes:**

- [ ] `D29C` Close the side panel.
  - **Expected:** Focus returns to `Testing Project`'s **Name** cell.
  - **Notes:**

- [ ] `D9DC` In the ⋯ menu of `Testing Project`, select **Remove project**.
  - **Expected:**
    - A hollow yellow dot is in `Testing Project`'s slot.
    - The row is struck through.
    - Its cells no longer open for editing.
  - **Notes:**

- [ ] `7BA7` Open the ⋯ menu of `Testing Project` again.
  - **Expected:**
    - The menu offers **Publish draft…** and **Discard draft**.
    - It has no **Remove project**.
  - **Notes:**

- [ ] `2F36` Run Publish.
  - **Expected:** The hollow dots are now solid yellow.
  - **Notes:**

### PROJ-08: The Project Manager Approves the Removal

**Account:** Project Manager, `project.manager@fathom.test`, changed from PROJ-07.

**Preconditions:** Signed in with this account. Run after PROJ-07. **Projects** tab open.

- [ ] `3D0B` Open the ⋯ menu of `Testing Project` and select **Approve draft…**.
  - **Expected:**
    - The dialog names the removal of "the project Testing Project".
    - As drafts it includes, it names the removal of each of its milestones.
  - **Notes:**

- [ ] `240C` Select **Approve** in the dialog.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] `DC38` On **Projects**, look for `Testing Project`.
  - **Expected:** It is not listed any more.
  - **Notes:**

- [ ] `966F` Select the **Milestones** tab, and look for `Pilot`, `Go live` and `Sign-off`.
  - **Expected:** None of them is listed any more.
  - **Notes:**

**Afterwards:** Run [Reset the Database](manual-test-basics.md#reset-the-database).
