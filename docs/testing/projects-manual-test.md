---
title: "Manual Test: Projects, Proposals, Customers and Milestones"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-08"
---

# Manual Test: Projects, Proposals, Customers and Milestones

## Scope

Verifies the Projects page: its four tabs and their tables, a record's side panel, a project's milestones and the dates they give it, what a Team Member, a Product Manager and a Project Manager can do there, and how drafts of these records are approved and removed.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place and the [Fictional Seed Data](../design/development-setup.md#fictional-seed-data) added.
- Roles as Fathom starts them: no change made to what any role grants in this clone's database.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom ([R0](#r0-start-fathom)), the second the data commands ([R1](#r1-restore-the-seed-data) and [R2](#r2-reset-the-database)).

## Test Accounts

[R1](#r1-restore-the-seed-data) creates these accounts, so they exist once it has run. They share one password, which it prints when it finishes.

- **Team Member account:** `team.member@fathom.test`, shown in Fathom as **Team Member**. It holds the Team Member role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Product Manager account:** `product.manager@fathom.test`, shown in Fathom as **Product Manager**. It holds the Product Manager role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Project Manager account:** `project.manager@fathom.test`, shown in Fathom as **Project Manager**. It holds the Project Manager role, as [Roles](../product/roles.md#starting-roles) sets out.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at the address `pnpm dev` prints, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use wherever a test case says so. Fathom keeps running. This removes the seed data and every draft of it, including drafts made during the test, then adds the seed data again; it keeps accounts and anything else added by hand, such as a customer added during the test.

1. In the second terminal, run:

   ```sh
   pnpm db:unseed && pnpm db:seed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

### R2: Reset the Database

Use only to run the test again after finishing it, since the records it adds stay once approved, and their names cannot be used twice. This deletes every account and record in the development database, including anything added by hand. Ask the owner before running it on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Start Fathom again ([R0](#r0-start-fathom)).

### P1: Publish

1. Select the **Publish** button in the top bar, followed by the number of changes waiting, such as **Publish 4 changes**.
2. Confirm that a notification says **Published**, and that the button is gone.

## Terms

- **Tabs:** **Projects**, **Proposals**, **Customers** and **Milestones**, in a row under the page's heading. The tab chosen is underlined.
- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft: added**, shown after a record's name. A hollow dot means the change is still unpublished.
- **Draft row and live row:** a record with a draft is tinted light blue; under it, a light green row marked **Live** shows the record as it is now.
- **⋯ menu:** the menu that opens from the **⋯** button at the end of a table row, or at the end of a milestone in a project's side panel.
- **Draft menu:** the **Draft** button above the table, beside the search box.
- **Side panel:** the panel on the right that opens from **Show details** in a row's ⋯ menu, or from the small button with an arrow out of a box at the right of a Name cell, shown while the row is pointed at. It is headed with the record's name, or with **New customer** or the like while adding one, and its close button, an **×**, is at its top right.
- **Appearance menu:** in the account menu at the top right of the top bar.
- **Dates:** the steps type dates as `2030-03-15`; the tables and the side panel show them as the browser's language writes them, such as **Mar 15, 2030**.

## Test Cases

Run the test cases in order, starting with [R0](#r0-start-fathom), then [R1](#r1-restore-the-seed-data). Check each step whose expected result you see, and write anything else under its notes. To run the test again, start from [R2](#r2-reset-the-database).

### PROJ-01: A Team Member Sees the Projects Read Only

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** [R1](#r1-restore-the-seed-data) run, then signed in with this account.

- [ ] **Step 1.** In the left-hand menu, select **Projects**.
  - **Expected:** The **Projects** page opens, with no **Later** tag beside **Projects** in the menu. The **Projects** tab is chosen. The table's columns are **Name**, **Project ID**, **Owner**, **Customers**, **Proposals**, **First milestone**, **Last milestone** and **Next delivery**, with a row for each seeded project. There is no **New project** button.
  - **Notes:**

- [ ] **Step 2.** Select the **Proposals** tab.
  - **Expected:** A table with **Name**, **Proposal ID**, **Link**, **Owner**, **Customers** and **Status**. The address bar changes.
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
  - **Expected:** The side panel opens, headed with the project's name, listing **Project ID**, **Owner**, **Customers**, **Proposals**, **First milestone**, **Last milestone** and **Next delivery**, then **Milestones** with each of the project's milestones and its date. There is no **Add milestone** button, and no milestone has a ⋯ button.
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
  - **Expected:** The side panel opens, headed **New customer**, with a **Name** box, and **Cancel** and **Add** at its foot.
  - **Notes:**

- [ ] **Step 3.** Type `Discard me` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 4.** Select **Cancel**.
  - **Expected:** A dialog asks **Discard the customer you're adding?**, with **Keep adding** and **Discard**.
  - **Notes:**

- [ ] **Step 5.** Select **Discard**.
  - **Expected:** The dialog and the form are gone.
  - **Notes:**

- [ ] **Step 6.** Select **New customer**.
  - **Expected:** The form opens again, and **Name** is empty.
  - **Notes:**

- [ ] **Step 7.** Select **Add** with **Name** empty.
  - **Expected:** **Name needed** shows in red under **Name**, and the form stays open.
  - **Notes:**

- [ ] **Step 8.** Type `Testing Customer` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 9.** Select **Add**.
  - **Expected:** The side panel is now headed **Testing Customer**, with a hollow yellow dot and **Draft: added**, and the table has a row for it with the same mark.
  - **Notes:**

### PROJ-03: The Product Manager Adds a Proposal and Changes Its Status

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-02.

**Preconditions:** Signed in with this account. Run after PROJ-02.

- [ ] **Step 1.** Select the **Proposals** tab.
  - **Expected:** The table of proposals shows.
  - **Notes:**

- [ ] **Step 2.** Select **New proposal**.
  - **Expected:** The side panel opens, headed **New proposal**, with **Name**, **Proposal ID**, **Link**, **Owner**, **Customers** and **Status**. **Status** already reads **Open**.
  - **Notes:**

- [ ] **Step 3.** Type `Testing Proposal` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 4.** Select **Add**.
  - **Expected:** The side panel is headed **Testing Proposal** with a hollow yellow dot and **Draft: added**, and **Status** reads **Open**.
  - **Notes:**

- [ ] **Step 5.** In the table, select the **Status** cell of **Testing Proposal**.
  - **Expected:** The cell is outlined.
  - **Notes:**

- [ ] **Step 6.** Press Enter.
  - **Expected:** The list of statuses opens.
  - **Notes:**

- [ ] **Step 7.** Type `Won` and press Enter.
  - **Expected:** The cell reads **Won**. The mark is still **Draft: added**, and the side panel shows **Status** as **Won**.
  - **Notes:**

### PROJ-04: The Product Manager Adds a Project With Milestones

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-03.

**Preconditions:** Signed in with this account. Run after PROJ-03.

- [ ] **Step 1.** Select the **Projects** tab, then **New project**.
  - **Expected:** The side panel opens, headed **New project**, with **Name**, **Project ID**, **Owner**, **Customers** and **Proposals**.
  - **Notes:**

- [ ] **Step 2.** Type `Testing Project` in **Name** and `TP-1` in **Project ID**.
  - **Expected:** Each box shows what was typed.
  - **Notes:**

- [ ] **Step 3.** In **Owner**, pick any person, and write the name in the notes.
  - **Expected:** **Owner** shows the name picked.
  - **Notes:**

- [ ] **Step 4.** In **Customers**, pick **Testing Customer**.
  - **Expected:** **Customers** shows **Testing Customer**.
  - **Notes:**

- [ ] **Step 5.** In **Proposals**, pick **Testing Proposal**.
  - **Expected:** **Proposals** shows **Testing Proposal**.
  - **Notes:**

- [ ] **Step 6.** Select **Add**.
  - **Expected:** The side panel is headed **Testing Project** with a hollow yellow dot and **Draft: added**, with the owner, **Testing Customer** and **Testing Proposal**. **First milestone**, **Last milestone** and **Next delivery** read **None**. Under **Milestones**, **No milestones yet** and an **Add milestone** button. The table has a row for it.
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
  - **Expected:** The dialog closes. Under **Milestones**, **Pilot** with a hollow yellow dot and **Draft: added** on one line, and under it the date for 2030-03-15 and **, customer delivery**. The **⋯** button is at the right of the panel.
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
  - **Expected:** **Go live** is listed after **Pilot**. In the panel, **First milestone** shows 2030-03-15, **Last milestone** 2030-06-30 and **Next delivery** 2030-03-15. The table's row for **Testing Project** shows the same three dates.
  - **Notes:**

- [ ] **Step 20.** Publish ([P1](#p1-publish)).
  - **Expected:** The marks on the customer, proposal, project and both milestones are now solid yellow dots with **Draft: added**.
  - **Notes:**

### PROJ-05: The Milestones Tab and a Project's Milestones

**Account:** Product Manager, `product.manager@fathom.test`, the same as PROJ-04.

**Preconditions:** Signed in with this account. Run after PROJ-04. **Projects** tab open.

- [ ] **Step 1.** Select the **Milestones** tab.
  - **Expected:** Every project's milestones are listed, among them **Pilot** and **Go live**, each with **Testing Project** under **Project**. **Pilot**'s **Customer delivery** box is ticked.
  - **Notes:**

- [ ] **Step 2.** Select the **Projects** tab.
  - **Expected:** The table of projects shows.
  - **Notes:**

- [ ] **Step 3.** In the ⋯ menu of **Testing Project**, select **Show milestones**.
  - **Expected:** The **Milestones** tab opens showing only **Pilot** and **Go live**, with a pill above the table reading **Project: Testing Project**, and beside it **2 of** followed by the number of all milestones.
  - **Notes:**

- [ ] **Step 4.** Select **New milestone**.
  - **Expected:** The side panel opens, headed **New milestone**, and **Project** already reads **Testing Project**.
  - **Notes:**

- [ ] **Step 5.** Type `Handover` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] **Step 6.** Type `20300901` in **Date**.
  - **Expected:** **Date** reads 2030-09-01 as it is typed.
  - **Notes:**

- [ ] **Step 7.** Select **Add**.
  - **Expected:** The side panel closes, and **Handover** is added with a hollow yellow dot and **Draft: added**.
  - **Notes:**

- [ ] **Step 8.** Select the **×** on the **Project: Testing Project** pill.
  - **Expected:** Every project's milestones show again.
  - **Notes:**

- [ ] **Step 9.** In the ⋯ menu of **Handover**, select **Show project**.
  - **Expected:** The **Projects** tab opens with **Testing Project**'s side panel, where **Last milestone** now shows 2030-09-01, and **Handover** is listed after **Go live**.
  - **Notes:**

- [ ] **Step 10.** Publish ([P1](#p1-publish)).
  - **Expected:** **Handover**'s mark becomes a solid yellow dot.
  - **Notes:**

### PROJ-06: The Project Manager Approves the Drafts

**Account:** Project Manager, `project.manager@fathom.test`, changed from PROJ-05.

**Preconditions:** Signed in with this account. Run after PROJ-05.

- [ ] **Step 1.** In the left-hand menu, select **Drafts**.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 2.** Type `Testing` in the search box.
  - **Expected:** An entry for each of **the customer Testing Customer**, **the proposal Testing Proposal**, **the project Testing Project**, and **the milestone Pilot of Testing Project**, **Go live** and **Handover** likewise, each saying **Product Manager** made it, with a box to select it.
  - **Notes:**

- [ ] **Step 3.** In the left-hand menu, select **Projects**.
  - **Expected:** The **Projects** page opens on the **Projects** tab.
  - **Notes:**

- [ ] **Step 4.** Select the **Customers** tab.
  - **Expected:** The table of customers shows.
  - **Notes:**

- [ ] **Step 5.** In the ⋯ menu of **Testing Customer**, select **Approve draft**.
  - **Expected:** A dialog asks to approve the draft, naming **the customer Testing Customer**.
  - **Notes:**

- [ ] **Step 6.** Select **Approve** in the dialog.
  - **Expected:** The mark goes, and **Testing Customer** is live.
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
  - **Expected:** **Testing Project** has no mark.
  - **Notes:**

- [ ] **Step 11.** Open **Show details** of **Testing Project**.
  - **Expected:** The side panel shows **Pilot**, **Go live** and **Handover** under **Milestones**, still marked **Draft: added**.
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
  - **Expected:** **Pilot**, **Go live** and **Handover** have no marks.
  - **Notes:**

- [ ] **Step 16.** Select the **Projects** tab.
  - **Expected:** **Testing Project** shows **Last milestone** 2030-09-01.
  - **Notes:**

### PROJ-07: The Product Manager Changes a Milestone, Then Removes the Project

**Account:** Product Manager, `product.manager@fathom.test`, changed from PROJ-06.

**Preconditions:** Signed in with this account. Run after PROJ-06. **Projects** tab open.

- [ ] **Step 1.** Open **Show details** of **Testing Project**.
  - **Expected:** The side panel shows **Testing Project**, with **Handover** under **Milestones**.
  - **Notes:**

- [ ] **Step 2.** In the ⋯ menu of **Handover**, select **Edit…**.
  - **Expected:** The **Edit milestone** dialog opens.
  - **Notes:**

- [ ] **Step 3.** Change **Date** to `20301015` and select **Save**.
  - **Expected:** **Handover** shows a hollow yellow dot and **Draft**. **Last milestone** shows 2030-10-15, with 2030-09-01 under it, dimmed, after a green dot and **Live**.
  - **Notes:**

- [ ] **Step 4.** Close the side panel.
  - **Expected:** Focus returns to **Testing Project**'s **Name** cell.
  - **Notes:**

- [ ] **Step 5.** In the ⋯ menu of **Testing Project**, select **Remove project**.
  - **Expected:** **Testing Project** is struck through, with a hollow yellow dot and **Draft: removed**. Its cells no longer open for editing.
  - **Notes:**

- [ ] **Step 6.** Open the ⋯ menu of **Testing Project** again.
  - **Expected:** The menu offers **Discard draft**, and no **Remove project**. Its cells do not open for editing.
  - **Notes:**

- [ ] **Step 7.** Publish ([P1](#p1-publish)).
  - **Expected:** The marks become solid yellow dots.
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

- [ ] **Step 4.** Select the **Milestones** tab, and look for **Pilot**, **Go live** and **Handover**.
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
  - **Expected:** Focus moves to **Customer delivery**, whose box stays unticked, and the **Date** cell shows the date.
  - **Notes:**

- [ ] **Step 5.** Press Shift+F10.
  - **Expected:** The row's menu opens.
  - **Notes:**

- [ ] **Step 6.** Select **Clear row**.
  - **Expected:** The row is empty again.
  - **Notes:**
