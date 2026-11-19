---
title: "Manual Test: Projects, Proposals, Customers and Milestones"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/projects.md"]
last_updated: "2026-11-19"
---

# Manual Test: Projects, Proposals, Customers and Milestones

## Scope

Verifies the Projects page: its four tabs and their tables, a record's side panel, a project's milestones and the dates they give it, what a Team Member, a Product Manager and a Project Manager can do there, and how drafts of these records are approved and removed.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Team Member:** `team.member@fathom.test`
- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Reset the Database](manual-test-basics.md#reset-the-database) and [Publish](manual-test-basics.md#publish).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Draft menu, the ⋯ menu, the side panel and dates. This test adds:

- **Tabs:** **Projects**, **Proposals**, **Customers** and **Milestones**, just after the page's heading, on the same line. The tab chosen is underlined.
- **Milestone ⋯ menu:** the menu that opens from the **⋯** button at the end of a milestone in a project's side panel.
- **New record panel:** the side panel while a record is being added, headed **New customer** or the like.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again after finishing it, start from Reset the Database, since the records it adds stay once approved, and their names cannot be used twice.

### PROJ-01: A Team Member Sees the Projects Read Only

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** Restore the Seed Data run, then signed in with this account.

- [ ] `D63F` Select the **Projects** page in the left-hand menu.
  - **Expected:**
    - The **Projects** page opens.
    - The **Projects** tab is chosen.
    - The table's columns are **Name**, **Project ID**, **Owner**, **Customers**, **Proposals**, **Features**, **First milestone**, **Last milestone** and **Next delivery**.
    - There is a row for each seeded project.
    - There is no **New project** button.
  - **Notes:**

- [ ] `8FE4` Select the **Proposals** tab.
  - **Expected:** A table shows **Name**, **Proposal ID**, **Link**, **Owner**, **Customers**, **Status** and **Features**.
  - **Notes:**

- [ ] `E116` Select the **Customers** tab.
  - **Expected:** A table with **Name**.
  - **Notes:**

- [ ] `A16F` Select the **Milestones** tab.
  - **Expected:** A table with **Name**, **Project**, **Date** and **Customer delivery**.
  - **Notes:**

- [ ] `ACE0` Select the browser's back button.
  - **Expected:** The **Customers** tab shows again.
  - **Notes:**

- [ ] `5FA4` Select the **Projects** tab.
  - **Expected:** The table of projects shows again.
  - **Notes:**

- [ ] `8D3E` On **Projects**, double-click the **Name** cell of any project.
  - **Expected:** Nothing changes: the cell does not open for editing.
  - **Notes:**

- [ ] `5AA6` Type a letter.
  - **Expected:** Nothing changes.
  - **Notes:**

- [ ] `FA04` Open the project's ⋯ menu and select **Show details**.
  - **Expected:**
    - The side panel opens, headed with the project's name.
    - It lists **Name**, **Project ID**, **Owner**, **Customers**, **Proposals**, **Features**, **First milestone**, **Last milestone** and **Next delivery**, then **Milestones** with each of the project's milestones and its date.
    - There is no **Add milestone** button.
    - No milestone has a ⋯ button.
  - **Notes:**

### PROJ-02: The Product Manager Adds a Customer

**Account:** Product Manager, `product.manager@fathom.test`, changed from PROJ-01.

**Preconditions:** Signed in with this account. **Projects** page open.

- [ ] `DFAE` Select the **Customers** tab.
  - **Expected:** The table of customers shows.
  - **Notes:**

- [ ] `7F45` Select **New customer** at the top right.
  - **Expected:**
    - The side panel opens, headed **New customer**.
    - It has a **Name** box.
    - **Cancel** and **Add** are at its foot.
  - **Notes:**

- [ ] `990D` Type `Discard me` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `AD18` Select **Cancel**.
  - **Expected:**
    - A dialog asks "Discard the new customer?"
    - It has **Keep adding** and **Discard**.
  - **Notes:**

- [ ] `5A03` Select **Discard**.
  - **Expected:**
    - The dialog is gone.
    - The form is gone.
  - **Notes:**

- [ ] `A3FD` Select **New customer**.
  - **Expected:**
    - The form opens again.
    - **Name** is empty.
  - **Notes:**

- [ ] `53AA` Select **Add** with **Name** empty.
  - **Expected:**
    - "Name needed" shows in red under **Name**.
    - The form stays open.
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

- [ ] `0B36` In the table, select the **Status** cell of `Testing Proposal`.
  - **Expected:** The cell is outlined.
  - **Notes:**

- [ ] `DDC9` Press Enter.
  - **Expected:** The list of statuses opens.
  - **Notes:**

- [ ] `C24D` Type `Won` and press Enter.
  - **Expected:**
    - The cell reads `Won`.
    - The row's slot still has its hollow yellow dot.
    - Pointing at the dot shows "Draft: added".
    - The side panel shows **Status** as `Won`.
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

- [ ] `F9B9` Select the change button in the **Owner** row, and pick any person, and write the name in the notes.
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
    - It shows the maintainer, `Testing Customer` and `Testing Proposal`.
    - **First milestone**, **Last milestone** and **Next delivery** read "None".
    - Under **Milestones** are "None" and an **Add milestone** button.
    - The table has a row for it.
  - **Notes:**

- [ ] `9CDA` In the side panel, select `Testing Customer`.
  - **Expected:**
    - The **Customers** tab opens.
    - `Testing Customer`'s side panel shows.
  - **Notes:**

- [ ] `A2B3` Select the browser's back button.
  - **Expected:** `Testing Project`'s side panel shows again.
  - **Notes:**

- [ ] `C344` In the side panel, select `Testing Proposal`.
  - **Expected:**
    - The **Proposals** tab opens.
    - `Testing Proposal`'s side panel shows.
  - **Notes:**

- [ ] `469B` Select the browser's back button.
  - **Expected:** `Testing Project`'s side panel shows again.
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
    - In the panel, **First milestone** shows "2030-03-15".
    - **Last milestone** shows "2030-06-30".
    - **Next delivery** shows "2030-03-15".
    - The table's row for `Testing Project` shows **First milestone** "2030-03-15", **Last milestone** "2030-06-30" and **Next delivery** "2030-03-15".
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

- [ ] `47EF` In the ⋯ menu of `Testing Project`, select **Show milestones**.
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
    - In the side panel, **Last milestone** now shows "2030-09-01".
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
    - Each row's **Made by** reads "Product Manager as Product Manager".
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

- [ ] `FB16` Select the Draft menu.
  - **Expected:**
    - The menu opens.
    - It has **Approve** and the number of waiting drafts, such as **Approve 6 drafts…**.
  - **Notes:**

- [ ] `F680` Select **Approve** with the number of waiting drafts shown.
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

- [ ] `2AF6` Select the Draft menu.
  - **Expected:**
    - The menu opens.
    - It has **Approve** and the number of waiting drafts.
  - **Notes:**

- [ ] `51A8` Select **Approve** with the number of waiting drafts shown.
  - **Expected:** A dialog says how many drafts it approves.
  - **Notes:**

- [ ] `C9D6` Select **Approve** in the dialog.
  - **Expected:** `Pilot`, `Go live` and `Sign-off` have no dots.
  - **Notes:**

- [ ] `8EC1` Select the **Projects** tab.
  - **Expected:** `Testing Project` shows **Last milestone** "2030-09-01".
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
    - `Sign-off`'s new date has a hollow yellow dot before it.
    - **Last milestone** shows "2030-10-15".
    - A hollow yellow dot is before "2030-10-15".
    - Under it is "2030-09-01".
    - A green dot is before "2030-09-01".
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
    - The menu offers **Discard draft**.
    - It has no **Remove project**.
    - Its cells do not open for editing.
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

### PROJ-09: Moving Across a New Milestone Row by Keyboard

**Account:** Product Manager, `product.manager@fathom.test`, changed from PROJ-08.

**Preconditions:** Signed in with this account. **Projects** page open, **Milestones** tab chosen.

- [ ] `D192` Select the **Name** cell of the empty row at the end of the table.
  - **Expected:** The cell is outlined.
  - **Notes:**

- [ ] `98CE` Type `Keyboard` and press Tab.
  - **Expected:** The **Project** cell opens for typing.
  - **Notes:**

- [ ] `0BF7` Press Tab.
  - **Expected:** The **Date** cell opens for typing.
  - **Notes:**

- [ ] `88A7` Type `20300501`.
  - **Expected:** The cell reads "2030-05-01" as it is typed.
  - **Notes:**

- [ ] `FB99` Press Tab.
  - **Expected:**
    - Focus moves to **Customer delivery**.
    - Its box stays unticked.
    - The **Date** cell shows the date.
  - **Notes:**

- [ ] `7CAB` Press Shift+F10.
  - **Expected:** The row's menu opens.
  - **Notes:**

- [ ] `6B3F` Select **Clear row**.
  - **Expected:** The row is empty again.
  - **Notes:**

### PROJ-10: The Product Manager Changes a Proposal in Its Side Panel

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-09.

**Preconditions:** Signed in with this account. **Projects** page open, **Proposals** tab chosen.

- [ ] `77F4` In the row 'Harbour Cranes Upgrade', open the row's ⋯ menu and select **Show details**.
  - **Expected:**
    - The side panel opens, headed 'Harbour Cranes Upgrade'.
    - Its first row is **Name**.
    - Each row has a change button at its right.
  - **Notes:**

- [ ] `CC32` Select the change button beside **Proposal ID**.
  - **Expected:** A box opens for **Proposal ID**.
  - **Notes:**

- [ ] `3B84` Select the **×** at the end of the box, if it holds anything.
  - **Expected:** The box is empty.
  - **Notes:**

- [ ] `C8EB` Type `PRO-9000` and press Enter.
  - **Expected:**
    - **Proposal ID** shows `PRO-9000`.
    - A hollow yellow dot is before `PRO-9000`.
    - Under it is 'PR-101'.
    - A green dot is before 'PR-101'.
    - The proposal's row in the table shows `PRO-9000` too.
  - **Notes:**

- [ ] `DCAF` Select the change button beside **Owner**, and choose a name from the list.
  - **Expected:**
    - **Owner** shows the name chosen.
    - The list is gone.
  - **Notes:**

- [ ] `D927` Select the change button beside **Name**.
  - **Expected:**
    - A box opens for **Name**.
    - It holds the proposal's name.
  - **Notes:**

- [ ] `71CB` Empty the box and press Enter.
  - **Expected:**
    - The box stays open.
    - It is outlined in red.
    - "Name needed" shows in red under it.
  - **Notes:**

- [ ] `C941` Press Esc.
  - **Expected:**
    - The box is gone.
    - **Name** shows 'Harbour Cranes Upgrade'.
    - Focus is on the change button beside **Name**.
  - **Notes:**

- [ ] `BD45` Open the **Draft** menu and select **Live only**.
  - **Expected:**
    - The panel shows no change buttons.
    - **Proposal ID** shows 'PR-101'.
  - **Notes:**

### PROJ-11: A Project's and a Proposal's Features

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-10.

**Preconditions:** Signed in with this account. Restore the Seed Data run. **Projects** page open, **Projects** tab chosen.

- [ ] `71C1` Look at the **Features** column.
  - **Expected:** Each project names the features it needs, separated by commas.
  - **Notes:**

- [ ] `D3DD` Point at a **Features** cell that names two features.
  - **Expected:** A tip lists the project's features, each on a line of its own.
  - **Notes:**

- [ ] `56B3` Open **Show details** of the same project.
  - **Expected:**
    - The side panel lists the project's features under **Features**.
    - Each is a link on a line of its own.
  - **Notes:**

- [ ] `AB8D` Select the first feature under **Features**.
  - **Expected:**
    - The **Features** page opens.
    - That feature's side panel is beside the table.
  - **Notes:**

- [ ] `3C89` Select the browser's back button.
  - **Expected:**
    - The **Projects** page shows.
    - The project's side panel shows.
  - **Notes:**

- [ ] `F63A` Select the **Proposals** tab.
  - **Expected:** The **Features** column names each proposal's features, separated by commas.
  - **Notes:**

- [ ] `E237` Point at a **Features** cell that names two features.
  - **Expected:** A tip lists the proposal's features, each on a line of its own.
  - **Notes:**

### PROJ-12: The Product Manager Adds a Feature a Project Needs

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-11.

**Preconditions:** Signed in with this account. Run after PROJ-11. **Projects** page open, **Projects** tab chosen.

- [ ] `A956` Select the **Features** cell of 'Internal Tools'.
  - **Expected:** The cell is outlined.
  - **Notes:**

- [ ] `26D7` Press Enter.
  - **Expected:**
    - A list of features opens.
    - It has a search box.
    - 'Usage Alerts' is marked as picked.
  - **Notes:**

- [ ] `FDBE` Pick one more feature from the list.
  - **Expected:** The feature is marked as picked.
  - **Notes:**

- [ ] `1B41` Press Esc.
  - **Expected:**
    - The list closes.
    - The cell names both features.
    - A hollow yellow dot is before them.
    - The row is tinted faint yellow.
    - Under it, a light green Live row's **Features** cell names 'Usage Alerts' alone.
  - **Notes:**
