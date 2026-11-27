---
title: "Manual Test: Projects, Proposals, Customers and Milestones"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/projects.md"]
last_updated: "2026-11-27"
---

# Manual Test: Projects, Proposals, Customers and Milestones

## Scope

Verifies the Projects page:

- Its four tabs and their tables as a Team Member sees them.
- Moving across a new milestone row by keyboard.
- Changing a proposal in its side panel.
- The features projects and proposals need.
- A customer's description and notes.
- The projects, proposals and features each customer's row and details list.
- A project's activities, and adding one from its details.
- Adding a customer, a project and a feature from a record's pickers and details.

[Drafts of Projects, Proposals, Customers and Milestones](project-drafts-manual-test.md) verifies adding a customer, a proposal and a project with milestones, and approving, changing and removing them.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Team Member:** `team.member@fathom.test`
- **Product Manager:** `product.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Draft menu, the ⋯ menu, the side panel and dates. This test adds:

- **Tabs:** **Projects**, **Proposals**, **Customers** and **Milestones**, just after the page's heading, on the same line. The tab chosen is underlined.

## Test Cases

Run the test cases in order, starting with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

To run the test again, run Restore the Seed Data first.

### PROJ-01: A Team Member Sees the Projects Read Only

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** Restore the Seed Data run, then signed in with this account.

- [ ] `D63F` Select the **Projects** page in the left-hand menu.
  - **Expected:**
    - The **Projects** page opens.
    - The **Projects** tab is chosen.
    - The table's columns are **Name**, **Project ID**, **Owner**, **Customers**, **Proposals**, **Features**, **Activities**, **First milestone**, **Last milestone** and **Next delivery**.
    - There is a row for each seeded project.
    - There is no **New project** button.
  - **Notes:**

- [ ] `8FE4` Select the **Proposals** tab.
  - **Expected:** A table shows **Name**, **Proposal ID**, **Link**, **Owner**, **Customers**, **Status** and **Features**.
  - **Notes:**

- [ ] `E116` Select the **Customers** tab.
  - **Expected:** A table with **Name**, **Description**, **Notes**, **Projects**, **Proposals** and **Features**.
  - **Notes:**

- [ ] `A16F` Select the **Milestones** tab.
  - **Expected:** A table with **Name**, **Project**, **Date** and **Customer delivery**.
  - **Notes:**

- [ ] `5FA4` Select the **Projects** tab.
  - **Expected:** The table of projects shows again.
  - **Notes:**

- [ ] `FA04` Open the ⋯ menu of 'Crane Control' and select **Show details**.
  - **Expected:**
    - The side panel opens, headed 'Crane Control'.
    - It lists **Name**, **Project ID**, **Owner**, **Customers**, **Proposals**, **Features**, **Activities**, **First milestone**, **Last milestone** and **Next delivery**, then **Milestones** with each of the project's milestones and its date.
    - There is no **Add milestone** button.
    - No milestone has a ⋯ button.
    - **Activities**, the row's name, is a link, and there is no **Add activity**.
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

**Account:** Product Manager, `product.manager@fathom.test`, the account PROJ-09 ended with.

**Preconditions:** Signed in with this account. **Projects** page open, **Proposals** tab chosen.

- [ ] `77F4` In the row 'Harbour Cranes Upgrade', open the row's ⋯ menu and select **Show details**.
  - **Expected:**
    - The side panel opens, headed 'Harbour Cranes Upgrade'.
    - Its first row is **Name**.
    - Pointing at each row shows a change button at its right.
  - **Notes:**

- [ ] `CC32` Select the change button beside **Proposal ID**.
  - **Expected:** A box opens for **Proposal ID**.
  - **Notes:**

- [ ] `C8EB` Clear the box, type `PRO-9000` and press Enter.
  - **Expected:**
    - **Proposal ID** shows `PRO-9000`.
    - A hollow yellow dot is before `PRO-9000`.
    - Under it is 'PR-101'.
    - A green dot is before 'PR-101'.
    - The proposal's row in the table shows `PRO-9000` too.
  - **Notes:**

- [ ] `D927` Select the change button beside **Name**.
  - **Expected:**
    - A box opens for **Name**.
    - It holds the proposal's name.
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

**Afterwards:** Open the **Draft** menu and select **Drafts & Live**, then run Discard the Unpublished Changes.

### PROJ-11: A Project's and a Proposal's Features

**Account:** Product Manager, `product.manager@fathom.test`, the account PROJ-10 ended with.

**Preconditions:** **Projects** page open, **Projects** tab chosen.

- [ ] `56B3` Open the ⋯ menu of 'Crane Control' and select **Show details**.
  - **Expected:**
    - The side panel lists 'Audit Export' and 'Offline Sync' under **Features**.
    - Each is a link on a line of its own.
  - **Notes:**

- [ ] `AB8D` Select 'Audit Export' under **Features**.
  - **Expected:**
    - The **Features** page opens.
    - The side panel headed 'Audit Export' is open.
  - **Notes:**

- [ ] `3C89` Select the browser's back button.
  - **Expected:**
    - The **Projects** page shows.
    - The project's side panel shows.
  - **Notes:**

### PROJ-12: The Product Manager Adds a Feature a Project Needs

**Account:** Product Manager, `product.manager@fathom.test`, the account PROJ-11 ended with.

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
    - The feature just picked has a hollow yellow dot before it.
    - 'Usage Alerts' has no dot before it.
    - The row is tinted faint yellow.
    - Under it, a light green Live row's **Features** cell names 'Usage Alerts' alone.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

### PROJ-13: A Customer's Description and Notes

**Account:** Product Manager, `product.manager@fathom.test`, the account PROJ-12 ended with.

**Preconditions:** Signed in with this account. **Projects** page open, **Customers** tab chosen.

- [ ] `8158` Select the ⋯ at the end of the row of 'Bluefin Harbour Authority', then **Show details**.
  - **Expected:**
    - Under **Details**: **Name**, **Description** and **Notes**, in that order.
    - **Description** reads "Port operator running two container terminals and a ferry quay."
    - **Notes** shows the note folded, fading out, with **Show more** under it.
  - **Notes:**

- [ ] `DF74` Select **Show more**.
  - **Expected:** The whole note opens in a panel of its own under the details, with "Quarterly review" in bold and a bulleted list.
  - **Notes:**

- [ ] `71FC` Select the ⋯ at the end of the row of 'Kestrel Mining Cooperative', then **Show details**.
  - **Expected:** **Description** and **Notes** each read "None", dimmed.
  - **Notes:**

### PROJ-16: The Product Manager Adds a Customer From a Proposal's Customers

**Account:** Product Manager, `product.manager@fathom.test`, the account PROJ-13 ended with.

**Preconditions:** Signed in with this account. **Projects** page open, **Proposals** tab chosen.

- [ ] `7A2C` Point at 'Fleet Tracking Bid' and select the details button at the right of its **Name** cell.
  - **Expected:** The side panel opens, headed 'Fleet Tracking Bid'.
  - **Notes:**

- [ ] `B3E1` Select the change button in the **Customers** row.
  - **Expected:**
    - A list of customers opens, with a search box.
    - The last item, under a line, reads "New customer", in blue.
  - **Notes:**

- [ ] `4D97` Type `Testing Ferries`.
  - **Expected:** The list holds only "New customer “Testing Ferries”", with no line above it.
  - **Notes:**

- [ ] `E05A` Press Enter.
  - **Expected:**
    - A second panel, headed **New customer**, opens under the details of 'Fleet Tracking Bid'.
    - Its **Name** shows `Testing Ferries`.
    - A **Maximize** button is before its close button.
    - **Cancel** and **Add** are at its foot.
  - **Notes:**

- [ ] `91CF` Select **Maximize** on the **New customer** panel.
  - **Expected:**
    - The **New customer** panel takes the side panel's whole height.
    - The details of 'Fleet Tracking Bid' are folded away.
    - The button now reads **Restore**.
  - **Notes:**

- [ ] `743A` Press Enter, with **Restore** still focused.
  - **Expected:**
    - Both panels show again, one above the other.
    - The button reads **Maximize** again and still has focus.
  - **Notes:**

- [ ] `C8D4` Select **Add**.
  - **Expected:**
    - The **New customer** panel is gone.
    - The **Customers** row names `Testing Ferries`, with a hollow yellow dot before it.
    - The change button in the **Customers** row has focus.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

### PROJ-14: What a Customer Gets and Asks For

**Account:** Product Manager, `product.manager@fathom.test`, the account PROJ-16 ended with.

**Preconditions:** Signed in with this account. **Projects** page open, **Customers** tab chosen.

- [ ] `7587` Look at the row of 'Kestrel Mining Cooperative'.
  - **Expected:**
    - **Projects** reads 'P-2017 Depot Operations', with 'P-2017' dimmed.
    - **Proposals** reads 'Ore Sorting Study'.
    - **Features** starts 'Barcode Scanning, Partner Portal', cut short where the column is too narrow for the rest.
  - **Notes:**

- [ ] `EB7D` Point at the **Features** cell of 'Kestrel Mining Cooperative'.
  - **Expected:** A tip lists these four, each on a line of its own:
    - 'Barcode Scanning'
    - 'Partner Portal'
    - 'Parts Lookup'
    - 'Work Order Sync'
  - **Notes:**

- [ ] `B074` Select the ⋯ at the end of the row of 'Kestrel Mining Cooperative'.
  - **Expected:**
    - The menu offers **Show all features**.
    - **Remove customer** is greyed out.
    - Under it, a line reads "P-2017 Depot Operations and 2 others name this customer."
  - **Notes:**

- [ ] `22DB` Select **Show all features**.
  - **Expected:**
    - The **Features** page opens.
    - Above the table, after **Views**, a pill reads "For Kestrel Mining Cooperative", with an × at its end.
    - The table shows only 'Barcode Scanning', 'Partner Portal', 'Parts Lookup' and 'Work Order Sync'.
  - **Notes:**

- [ ] `5004` Select the × on the pill "For Kestrel Mining Cooperative".
  - **Expected:**
    - The pill is gone.
    - The table shows every feature again.
  - **Notes:**

### PROJ-15: A Customer's Details

**Account:** Product Manager, `product.manager@fathom.test`, the account PROJ-14 ended with.

**Preconditions:** Signed in with this account. **Projects** page open, **Customers** tab chosen.

- [ ] `4B55` Select the ⋯ at the end of the row of 'Kestrel Mining Cooperative', then **Show details**.
  - **Expected:**
    - The side panel's headings are **Details**, then **Commitments**.
    - Under **Commitments**, one to a line:
      - **Projects**: 'P-2017 Depot Operations', a link, with 'P-2017' dimmed.
      - **Proposals**: 'Ore Sorting Study', a link.
      - **Features**: 'Barcode Scanning', 'Partner Portal', 'Parts Lookup' and 'Work Order Sync', each a link on a line of its own.
  - **Notes:**

- [ ] `8251` Select 'P-2017 Depot Operations' under **Commitments**.
  - **Expected:**
    - The **Projects** tab is chosen.
    - The side panel shows the details of 'Depot Operations'.
  - **Notes:**

### PROJ-18: A Project's Activities

**Account:** Product Manager, `product.manager@fathom.test`, the account PROJ-15 ended with.

**Preconditions:** **Projects** page open, **Projects** tab chosen, with **Drafts & Live** chosen in the Draft menu.

- [ ] `9737` Open the ⋯ menu of 'Crane Control' and select **Show details**.
  - **Expected:**
    - The side panel lists the project's activities under **Activities**, each a link on a line of its own.
    - **Activities**, the row's name, is a link, and **Add activity** is under the list.
  - **Notes:**

- [ ] `D4E1` Select **Activities**, the row's name.
  - **Expected:**
    - The **Activities** page opens.
    - The table shows only the activities of 'Crane Control'.
  - **Notes:**

- [ ] `5DB3` Select the browser's back button.
  - **Expected:** The details of 'Crane Control' show on **Projects**.
  - **Notes:**

- [ ] `6F18` Select **Add activity**.
  - **Expected:**
    - A second panel, headed **New activity**, opens under the details of 'Crane Control', on **Projects**.
    - **Project** reads 'P-2001 Crane Control'.
    - **Release** reads "None".
  - **Notes:**

- [ ] `4F2A` Type `Fictional Rehearsal` in **Name**.
  - **Expected:** The name is in the field.
  - **Notes:**

- [ ] `640E` Select **Add**.
  - **Expected:**
    - The **New activity** panel closes, and focus is on **Add activity**.
    - 'Fictional Rehearsal' is listed under **Activities** in the details of 'Crane Control'.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

### PROJ-19: A Team Member Sees a Project's Activities

Covered by [PROJ-01](#proj-01-a-team-member-sees-the-projects-read-only).

### PROJ-17: The Product Manager Adds a Project From a New Milestone's Row

**Account:** Product Manager, `product.manager@fathom.test`, the account PROJ-18 ended with.

**Preconditions:** **Projects** page open, **Milestones** tab chosen.

- [ ] `0D6B` Select the **Name** cell of the empty row at the end of the table.
  - **Expected:** The cell is outlined.
  - **Notes:**

- [ ] `E3A1` Type `Survey done` and press Tab.
  - **Expected:** The **Project** cell opens for typing, with a list of projects under it.
  - **Notes:**

- [ ] `74E2` Type `Testing Harbour`.
  - **Expected:** The list holds only "New project “Testing Harbour”", in blue, with no line above it.
  - **Notes:**

- [ ] `C5A9` Press Enter.
  - **Expected:**
    - The side panel opens, headed **New project**.
    - Its **Name** shows `Testing Harbour`.
  - **Notes:**

- [ ] `92F0` Select **Add**.
  - **Expected:**
    - The **New project** panel is gone.
    - The row's **Name** reads `Survey done`.
    - The row's **Project** reads `Testing Harbour`.
    - The **Project** cell is outlined.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

### PROJ-20: The Product Manager Adds a New Feature to a Proposal

**Account:** Product Manager, `product.manager@fathom.test`, the account PROJ-17 ended with.

**Preconditions:** **Projects** page open, **Proposals** tab chosen.

- [ ] `6C1E` Point at 'Harbour Cranes Upgrade' and select the details button at the right of its **Name** cell.
  - **Expected:**
    - The side panel opens, headed 'Harbour Cranes Upgrade'.
    - Under the features listed in its **Features** row are two outlined buttons, **Choose features** then **New feature**, at the left.
    - The **Features** row has no change button.
  - **Notes:**

- [ ] `A47D` Select **New feature**.
  - **Expected:**
    - A second panel, headed **New feature**, opens under the details of 'Harbour Cranes Upgrade'.
    - The cursor is in its **Name**.
    - Its **Status** reads 'Possible'.
  - **Notes:**

- [ ] `0E93` Type `Fictional Quay Lights` in **Name**, and select **Add**.
  - **Expected:**
    - The **New feature** panel closes.
    - **Features** names 'Fictional Quay Lights' last, with a hollow yellow dot before it.
    - The header's 'Harbour Cranes Upgrade' has a hollow yellow dot before it.
    - Focus is on **New feature**.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.
