---
title: "Manual Test: Projects, Proposals, Customers and Milestones"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/projects.md"]
last_updated: "2026-11-24"
---

# Manual Test: Projects, Proposals, Customers and Milestones

## Scope

Verifies the Projects page: its four tabs and their tables as a Team Member sees them, moving across a new milestone row by keyboard, changing a proposal in its side panel, and the features projects and proposals need. [Drafts of Projects, Proposals, Customers and Milestones](project-drafts-manual-test.md) verifies adding a customer, a proposal and a project with milestones, and approving, changing and removing them.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Team Member:** `team.member@fathom.test`
- **Product Manager:** `product.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Draft menu, the ⋯ menu, the side panel and dates. This test adds:

- **Tabs:** **Projects**, **Proposals**, **Customers** and **Milestones**, just after the page's heading, on the same line. The tab chosen is underlined.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again, run Restore the Seed Data first.

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

Moved to [Drafts of Projects, Proposals, Customers and Milestones](project-drafts-manual-test.md#proj-02-the-product-manager-adds-a-customer).

### PROJ-03: The Product Manager Adds a Proposal and Changes Its Status

Moved to [Drafts of Projects, Proposals, Customers and Milestones](project-drafts-manual-test.md#proj-03-the-product-manager-adds-a-proposal-and-changes-its-status).

### PROJ-04: The Product Manager Adds a Project With Milestones

Moved to [Drafts of Projects, Proposals, Customers and Milestones](project-drafts-manual-test.md#proj-04-the-product-manager-adds-a-project-with-milestones).

### PROJ-05: The Milestones Tab and a Project's Milestones

Moved to [Drafts of Projects, Proposals, Customers and Milestones](project-drafts-manual-test.md#proj-05-the-milestones-tab-and-a-projects-milestones).

### PROJ-06: The Project Manager Approves the Drafts

Moved to [Drafts of Projects, Proposals, Customers and Milestones](project-drafts-manual-test.md#proj-06-the-project-manager-approves-the-drafts).

### PROJ-07: The Product Manager Changes a Milestone, Then Removes the Project

Moved to [Drafts of Projects, Proposals, Customers and Milestones](project-drafts-manual-test.md#proj-07-the-product-manager-changes-a-milestone-then-removes-the-project).

### PROJ-08: The Project Manager Approves the Removal

Moved to [Drafts of Projects, Proposals, Customers and Milestones](project-drafts-manual-test.md#proj-08-the-project-manager-approves-the-removal).

### PROJ-09: Moving Across a New Milestone Row by Keyboard

**Account:** Product Manager, `product.manager@fathom.test`, changed from PROJ-01.

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

- [ ] `1B41` Press Enter.
  - **Expected:**
    - The list closes.
    - The cell names both features.
    - A hollow yellow dot is before them.
    - The row is tinted faint yellow.
    - Under it, a light green Live row's **Features** cell names 'Usage Alerts' alone.
  - **Notes:**
