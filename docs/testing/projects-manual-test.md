---
title: "Manual Test: Projects, Proposals, Customers and Milestones"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
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

- **Tabs:** **Projects**, **Proposals**, **Customers** and **Milestones**, in a row under the page's heading. The tab chosen is underlined.
- **Milestone ⋯ menu:** the menu that opens from the **⋯** button at the end of a milestone in a project's side panel.
- **New record panel:** the side panel while a record is being added, headed **New customer** or the like.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again after finishing it, start from Reset the Database, since the records it adds stay once approved, and their names cannot be used twice.

### PROJ-01: A Team Member Sees the Projects Read Only

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** Restore the Seed Data run, then signed in with this account.

- [ ] **Step 1.** Select the **Projects** page in the left-hand menu.
  - **Expected:**
    - The **Projects** page opens, with no **Later** tag beside **Projects** in the menu.
    - The **Projects** tab is chosen.
    - The table's columns are **Name**, **Project ID**, **Owner**, **Customers**, **Proposals**, **Features**, **First milestone**, **Last milestone** and **Next delivery**, with a row for each seeded project.
    - There is no **New project** button.
  - **Notes:**

- [ ] **Step 2.** Select the **Proposals** tab.
  - **Expected:**
    - A table shows **Name**, **Proposal ID**, **Link**, **Owner**, **Customers**, **Status** and **Features**.
    - The address bar changes.
  - **Notes:**

- [ ] **Step 3.** Select the **Customers** tab.
  - **Expected:** A table with **Name**.
  - **Notes:**

- [ ] **Step 4.** Select the **Milestones** tab.
  - **Expected:** A table with **Name**, **Project**, **Date** and **Customer delivery**.
  - **Notes:**

- [ ] **Step 5.** Select the browser's back button.
  - **Expected:** The **Customers** tab shows again.
  - **Notes:**

- [ ] **Step 6.** Select the **Projects** tab.
  - **Expected:** The table of projects shows again.
  - **Notes:**

- [ ] **Step 7.** On **Projects**, double-click the **Name** cell of any project.
  - **Expected:** Nothing changes: the cell does not open for editing.
  - **Notes:**

- [ ] **Step 8.** Type a letter.
  - **Expected:** Nothing changes.
  - **Notes:**

- [ ] **Step 9.** Open the project's ⋯ menu and select **Show details**.
  - **Expected:**
    - The side panel opens, headed with the project's name, listing **Name**, **Project ID**, **Owner**, **Customers**, **Proposals**, **Features**, **First milestone**, **Last milestone** and **Next delivery**, then **Milestones** with each of the project's milestones and its date.
    - There is no **Add milestone** button, and no milestone has a ⋯ button.
  - **Notes:**

- [ ] **Step 10.** Select **Light** in the Appearance menu.
  - **Expected:** Text, marks and tabs on the page and side panel are easy to read.
  - **Notes:**

- [ ] **Step 11.** Select **Dark** in the Appearance menu.
  - **Expected:** Text, marks and tabs on the page and side panel are easy to read.
  - **Notes:**

### PROJ-02: The Product Manager Adds a Customer

**Account:** Product Manager, `product.manager@fathom.test`, changed from PROJ-01.

**Preconditions:** Signed in with this account. **Projects** page open.

- [ ] **Step 1.** Select the **Customers** tab.
  - **Expected:** The table of customers shows.
  - **Notes:**

- [ ] **Step 2.** Select **New customer** at the top right.
  - **Expected:**
    - The side panel opens, headed **New customer**, with a **Name** box.
    - **Cancel** and **Add** are at its foot.
  - **Notes:**

- [ ] **Step 3.** Type `Discard me` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 4.** Select **Cancel**.
  - **Expected:** A dialog asks **Discard the new customer?**, with **Keep adding** and **Discard**.
  - **Notes:**

- [ ] **Step 5.** Select **Discard**.
  - **Expected:** The dialog and the form are gone.
  - **Notes:**

- [ ] **Step 6.** Select **New customer**.
  - **Expected:**
    - The form opens again.
    - **Name** is empty.
  - **Notes:**

- [ ] **Step 7.** Select **Add** with **Name** empty.
  - **Expected:**
    - **Name needed** shows in red under **Name**.
    - The form stays open.
  - **Notes:**

- [ ] **Step 8.** Type `Testing Customer` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 9.** Select **Add**.
  - **Expected:**
    - The side panel is now headed **Testing Customer**, with a hollow yellow dot before it.
    - The table has a row for it, with a hollow yellow dot in its slot.
  - **Notes:**

### PROJ-03: The Product Manager Adds a Proposal and Changes Its Status

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-02.

**Preconditions:** Signed in with this account. Run after PROJ-02.

- [ ] **Step 1.** Select the **Proposals** tab.
  - **Expected:** The table of proposals shows.
  - **Notes:**

- [ ] **Step 2.** Select **New proposal**.
  - **Expected:**
    - The side panel opens, headed **New proposal**, with **Name**, **Proposal ID**, **Link**, **Owner**, **Customers**, **Status** and **Features**.
    - **Status** already reads **Open**.
  - **Notes:**

- [ ] **Step 3.** Type `Testing Proposal` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 4.** Select **Add**.
  - **Expected:**
    - The side panel is headed **Testing Proposal**, with a hollow yellow dot before it.
    - **Status** reads **Open**.
  - **Notes:**

- [ ] **Step 5.** In the table, select the **Status** cell of **Testing Proposal**.
  - **Expected:** The cell is outlined.
  - **Notes:**

- [ ] **Step 6.** Press Enter.
  - **Expected:** The list of statuses opens.
  - **Notes:**

- [ ] **Step 7.** Type `Won` and press Enter.
  - **Expected:**
    - The cell reads **Won**.
    - The row's slot still has its hollow yellow dot.
    - Pointing at the dot shows **Draft: added**.
    - The side panel shows **Status** as **Won**.
  - **Notes:**

### PROJ-04: The Product Manager Adds a Project With Milestones

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-03.

**Preconditions:** Signed in with this account. Run after PROJ-03.

- [ ] **Step 1.** Select the **Projects** tab, then **New project**.
  - **Expected:** The side panel opens, headed **New project**, with **Name**, **Project ID**, **Owner**, **Customers**, **Proposals** and **Features**.
  - **Notes:**

- [ ] **Step 2.** Type `Testing Project` in **Name** and `TP-1` in **Project ID**.
  - **Expected:** Each box shows what was typed.
  - **Notes:**

- [ ] **Step 3.** Select the pencil button in the **Owner** row, and pick any person, and write the name in the notes.
  - **Expected:** **Owner** shows the name picked.
  - **Notes:**

- [ ] **Step 4.** Select the pencil button in the **Customers** row, and pick **Testing Customer**.
  - **Expected:** **Customers** shows **Testing Customer**.
  - **Notes:**

- [ ] **Step 5.** Select the pencil button in the **Proposals** row, and pick **Testing Proposal**.
  - **Expected:** **Proposals** shows **Testing Proposal**.
  - **Notes:**

- [ ] **Step 6.** Select **Add**.
  - **Expected:**
    - The side panel is headed **Testing Project**, with a hollow yellow dot before it.
    - It shows the owner, **Testing Customer** and **Testing Proposal**.
    - **First milestone**, **Last milestone** and **Next delivery** read **None**.
    - Under **Milestones** are **No milestones yet** and an **Add milestone** button.
    - The table has a row for it.
  - **Notes:**

- [ ] **Step 7.** In the side panel, select **Testing Customer**.
  - **Expected:** The **Customers** tab opens with **Testing Customer**'s side panel.
  - **Notes:**

- [ ] **Step 8.** Select the browser's back button.
  - **Expected:** **Testing Project**'s side panel shows again.
  - **Notes:**

- [ ] **Step 9.** In the side panel, select **Testing Proposal**.
  - **Expected:** The **Proposals** tab opens with **Testing Proposal**'s side panel.
  - **Notes:**

- [ ] **Step 10.** Select the browser's back button.
  - **Expected:** **Testing Project**'s side panel shows again.
  - **Notes:**

- [ ] **Step 11.** Select **Add milestone**.
  - **Expected:** A dialog titled **New milestone** opens.
  - **Notes:**

- [ ] **Step 12.** Type `Pilot` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 13.** Type `20300315` in **Date**.
  - **Expected:** **Date** reads 2030-03-15.
  - **Notes:**

- [ ] **Step 14.** Tick **Customer delivery**.
  - **Expected:** The box is ticked.
  - **Notes:**

- [ ] **Step 15.** Select **Add milestone** in the dialog.
  - **Expected:**
    - The dialog closes.
    - Under **Milestones**, **Pilot** shows on one line, with a hollow yellow dot before it.
    - Under **Pilot**, the date for 2030-03-15 and **, customer delivery**.
    - The **⋯** button is at the right of the panel.
  - **Notes:**

- [ ] **Step 16.** Select **Add milestone**.
  - **Expected:** A dialog titled **New milestone** opens.
  - **Notes:**

- [ ] **Step 17.** Type `Go live` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 18.** Type `20300630` in **Date**.
  - **Expected:** **Date** reads 2030-06-30.
  - **Notes:**

- [ ] **Step 19.** Select **Add milestone** in the dialog, leaving **Customer delivery** unticked.
  - **Expected:**
    - **Go live** is listed after **Pilot**.
    - In the panel, **First milestone** shows 2030-03-15, **Last milestone** 2030-06-30 and **Next delivery** 2030-03-15.
    - The table's row for **Testing Project** shows the same three dates.
  - **Notes:**

- [ ] **Step 20.** Run Publish.
  - **Expected:** The dots before the customer, proposal, project and both milestones are now solid yellow.
  - **Notes:**

### PROJ-05: The Milestones Tab and a Project's Milestones

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-04.

**Preconditions:** Signed in with this account. Run after PROJ-04. **Projects** tab open.

- [ ] **Step 1.** Select the **Milestones** tab.
  - **Expected:**
    - Every project's milestones are listed, among them **Pilot** and **Go live**, each with **Testing Project** under **Project**, after **TP-1** in grey.
    - **Pilot**'s **Customer delivery** box is ticked.
  - **Notes:**

- [ ] **Step 2.** Select the **Projects** tab.
  - **Expected:** The table of projects shows.
  - **Notes:**

- [ ] **Step 3.** In the ⋯ menu of **Testing Project**, select **Show milestones**.
  - **Expected:**
    - The **Milestones** tab opens showing only **Pilot** and **Go live**, with a pill above the table reading **Project: TP-1 Testing Project**.
    - Beside the pill, **2 of** is followed by the number of all milestones.
  - **Notes:**

- [ ] **Step 4.** Select **New milestone**.
  - **Expected:**
    - The side panel opens, headed **New milestone**.
    - **Project** already reads **TP-1 Testing Project**.
  - **Notes:**

- [ ] **Step 5.** Type `Sign-off` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 6.** Type `20300901` in **Date**.
  - **Expected:** **Date** reads 2030-09-01 as it is typed.
  - **Notes:**

- [ ] **Step 7.** Select **Add**.
  - **Expected:**
    - The side panel closes.
    - **Sign-off** is added, with a hollow yellow dot in its slot.
  - **Notes:**

- [ ] **Step 8.** Select the **×** on the **Project: TP-1 Testing Project** pill.
  - **Expected:** Every project's milestones show again.
  - **Notes:**

- [ ] **Step 9.** In the ⋯ menu of **Sign-off**, select **Show project**.
  - **Expected:**
    - The **Projects** tab opens with **Testing Project**'s side panel, where **Last milestone** now shows 2030-09-01.
    - **Sign-off** is listed after **Go live**.
  - **Notes:**

- [ ] **Step 10.** Run Publish.
  - **Expected:** **Sign-off**'s dot is now solid yellow.
  - **Notes:**

### PROJ-06: The Project Manager Approves the Drafts

**Account:** Project Manager, `project.manager@fathom.test`, changed from PROJ-05.

**Preconditions:** Signed in with this account. Run after PROJ-05.

- [ ] **Step 1.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 2.** Type `Testing` in the search box.
  - **Expected:** An entry for each of these, each saying **Product Manager** made it, with a box to select it:
    - **the customer Testing Customer**
    - **the proposal Testing Proposal**
    - **the project Testing Project**
    - **the milestone Pilot of Testing Project**, and **Go live** and **Sign-off** likewise
  - **Notes:**

- [ ] **Step 3.** Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens on the **Projects** tab.
  - **Notes:**

- [ ] **Step 4.** Select the **Customers** tab.
  - **Expected:** The table of customers shows.
  - **Notes:**

- [ ] **Step 5.** In the ⋯ menu of **Testing Customer**, select **Approve draft**.
  - **Expected:** A dialog asks **Approve 1 draft?**.
  - **Notes:**

- [ ] **Step 6.** Select **Approve** in the dialog.
  - **Expected:**
    - The dot goes.
    - **Testing Customer** is live.
  - **Notes:**

- [ ] **Step 7.** Select the **Projects** tab.
  - **Expected:** The table of projects shows.
  - **Notes:**

- [ ] **Step 8.** Select the Draft menu.
  - **Expected:** The menu opens, with **Approve** and the number of waiting drafts, such as **Approve 6 drafts…**.
  - **Notes:**

- [ ] **Step 9.** Select **Approve** with the number of waiting drafts shown.
  - **Expected:** A dialog says how many drafts it approves and lists, under **Also approves the drafts these depend on:**, **the proposal Testing Proposal**.
  - **Notes:**

- [ ] **Step 10.** Select **Approve** in the dialog.
  - **Expected:** **Testing Project** has no dot.
  - **Notes:**

- [ ] **Step 11.** Open **Show details** of **Testing Project**.
  - **Expected:**
    - The side panel shows **Pilot**, **Go live** and **Sign-off** under **Milestones**.
    - Each still has a yellow dot before it.
  - **Notes:**

- [ ] **Step 12.** Select the **Milestones** tab.
  - **Expected:** The table of milestones shows.
  - **Notes:**

- [ ] **Step 13.** Select the Draft menu.
  - **Expected:** The menu opens, with **Approve** and the number of waiting drafts.
  - **Notes:**

- [ ] **Step 14.** Select **Approve** with the number of waiting drafts shown.
  - **Expected:** A dialog says how many drafts it approves.
  - **Notes:**

- [ ] **Step 15.** Select **Approve** in the dialog.
  - **Expected:** **Pilot**, **Go live** and **Sign-off** have no dots.
  - **Notes:**

- [ ] **Step 16.** Select the **Projects** tab.
  - **Expected:** **Testing Project** shows **Last milestone** 2030-09-01.
  - **Notes:**

### PROJ-07: The Product Manager Changes a Milestone, Then Removes the Project

**Account:** Product Manager, `product.manager@fathom.test`, changed from PROJ-06.

**Preconditions:** Signed in with this account. Run after PROJ-06. **Projects** tab open.

- [ ] **Step 1.** Open **Show details** of **Testing Project**.
  - **Expected:**
    - The side panel shows **Testing Project**.
    - **Sign-off** is under **Milestones**.
  - **Notes:**

- [ ] **Step 2.** In the ⋯ menu of **Sign-off**, select **Edit…**.
  - **Expected:** The **Edit milestone** dialog opens.
  - **Notes:**

- [ ] **Step 3.** Change **Date** to `20301015` and select **Save**.
  - **Expected:**
    - **Sign-off**'s new date has a hollow yellow dot before it.
    - **Last milestone** shows 2030-10-15, with a hollow yellow dot before it.
    - Under it, 2030-09-01, with a green dot before it.
  - **Notes:**

- [ ] **Step 4.** Close the side panel.
  - **Expected:** Focus returns to **Testing Project**'s **Name** cell.
  - **Notes:**

- [ ] **Step 5.** In the ⋯ menu of **Testing Project**, select **Remove project**.
  - **Expected:**
    - A hollow yellow dot is in **Testing Project**'s slot.
    - The row is struck through.
    - Its cells no longer open for editing.
  - **Notes:**

- [ ] **Step 6.** Open the ⋯ menu of **Testing Project** again.
  - **Expected:**
    - The menu offers **Discard draft**, and no **Remove project**.
    - Its cells do not open for editing.
  - **Notes:**

- [ ] **Step 7.** Run Publish.
  - **Expected:** The hollow dots are now solid yellow.
  - **Notes:**

### PROJ-08: The Project Manager Approves the Removal

**Account:** Project Manager, `project.manager@fathom.test`, changed from PROJ-07.

**Preconditions:** Signed in with this account. Run after PROJ-07. **Projects** tab open.

- [ ] **Step 1.** Open the ⋯ menu of **Testing Project** and select **Approve draft**.
  - **Expected:** The dialog names the removal of **the project Testing Project** and, as drafts it includes, the removal of each of its milestones.
  - **Notes:**

- [ ] **Step 2.** Select **Approve** in the dialog.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] **Step 3.** On **Projects**, look for **Testing Project**.
  - **Expected:** It is not listed any more.
  - **Notes:**

- [ ] **Step 4.** Select the **Milestones** tab, and look for **Pilot**, **Go live** and **Sign-off**.
  - **Expected:** None of them is listed any more.
  - **Notes:**

### PROJ-09: Moving Across a New Milestone Row by Keyboard

**Account:** Product Manager, `product.manager@fathom.test`, changed from PROJ-08.

**Preconditions:** Signed in with this account. **Projects** page open, **Milestones** tab chosen.

- [ ] **Step 1.** Select the **Name** cell of the empty row at the end of the table, type `Keyboard`, and press Tab.
  - **Expected:** The **Project** cell opens for typing.
  - **Notes:**

- [ ] **Step 2.** Press Tab.
  - **Expected:** The **Date** cell opens for typing.
  - **Notes:**

- [ ] **Step 3.** Type `20300501`.
  - **Expected:** The cell reads 2030-05-01 as it is typed.
  - **Notes:**

- [ ] **Step 4.** Press Tab.
  - **Expected:**
    - Focus moves to **Customer delivery**, whose box stays unticked.
    - The **Date** cell shows the date.
  - **Notes:**

- [ ] **Step 5.** Press Shift+F10.
  - **Expected:** The row's menu opens.
  - **Notes:**

- [ ] **Step 6.** Select **Clear row**.
  - **Expected:** The row is empty again.
  - **Notes:**

### PROJ-10: The Product Manager Changes a Proposal in Its Side Panel

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-09.

**Preconditions:** Signed in with this account. **Projects** page open, **Proposals** tab chosen.

- [ ] **Step 1.** In the row **Harbour Cranes Upgrade**, open the row's ⋯ menu and select **Show details**.
  - **Expected:**
    - The side panel opens, headed **Harbour Cranes Upgrade**.
    - Its first row is **Name**, and each row has a small pencil button at its right.
  - **Notes:**

- [ ] **Step 2.** Select the pencil beside **Proposal ID**, select the **×** at the end of the box if it holds anything, type `PRO-9000`, and press Enter.
  - **Expected:**
    - **Proposal ID** shows `PRO-9000`, with a hollow yellow dot before it.
    - Under it, **PR-101**, with a green dot before it.
    - The proposal's row in the table shows `PRO-9000` too.
  - **Notes:**

- [ ] **Step 3.** Select the pencil beside **Owner**, and choose a name from the list.
  - **Expected:**
    - **Owner** shows the name chosen.
    - The list is gone.
  - **Notes:**

- [ ] **Step 4.** Select the pencil beside **Name**, empty the box, and press Enter.
  - **Expected:** The box stays open, outlined in red, with **Name needed** in red under it.
  - **Notes:**

- [ ] **Step 5.** Press Esc.
  - **Expected:**
    - The box is gone.
    - **Name** shows the proposal's name as before.
    - Focus is on the pencil beside **Name**.
  - **Notes:**

- [ ] **Step 6.** Open the **Draft** menu and select **Live only**.
  - **Expected:**
    - The panel shows no pencil buttons.
    - **Proposal ID** shows **PR-101**.
  - **Notes:**

### PROJ-11: A Project's and a Proposal's Features

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-10.

**Preconditions:** Signed in with this account. Restore the Seed Data run. **Projects** page open, **Projects** tab chosen.

- [ ] **Step 1.** Look at the **Features** column.
  - **Expected:** Each project names the features it needs, separated by commas.
  - **Notes:**

- [ ] **Step 2.** Point at a **Features** cell that names two features.
  - **Expected:** A tip lists the project's features, each on a line of its own.
  - **Notes:**

- [ ] **Step 3.** Open **Show details** of the same project.
  - **Expected:** The side panel lists the same features under **Features**, each a link on a line of its own.
  - **Notes:**

- [ ] **Step 4.** Select the first feature under **Features**.
  - **Expected:** The **Features** page opens, with that feature's side panel beside the table.
  - **Notes:**

- [ ] **Step 5.** Select the browser's back button.
  - **Expected:** The **Projects** page shows again, with the project's side panel.
  - **Notes:**

- [ ] **Step 6.** Select the **Proposals** tab.
  - **Expected:** The **Features** column names each proposal's features the same way, with the same tip.
  - **Notes:**

### PROJ-12: The Product Manager Adds a Feature a Project Needs

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-11.

**Preconditions:** Signed in with this account. Run after PROJ-11. **Projects** page open, **Projects** tab chosen.

- [ ] **Step 1.** Select the **Features** cell of **Internal Tools**, and press Enter.
  - **Expected:**
    - A list of features opens, with a search box.
    - **Usage Alerts** is marked as picked.
  - **Notes:**

- [ ] **Step 2.** Pick one more feature from the list, and press Esc.
  - **Expected:**
    - The list closes.
    - The cell names both features, with a hollow yellow dot before them.
    - The row is tinted faint yellow.
    - Under it, a light green Live row's **Features** cell names **Usage Alerts** alone.
  - **Notes:**
