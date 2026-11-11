---
title: "Manual Test: Feature Links"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-10"
---

# Manual Test: Feature Links

## Scope

Verifies the projects and proposals that name a feature on the Features page: how they read, following them to their details beside Features, changing them as drafts of each project and proposal, Show features in a project's and a proposal's menu, filtering by them, and who may change them. The rest of the Features page is verified in [Features](features-manual-test.md).

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account. They share one password, which R1 prints when it finishes.

- **Product Manager account:** `product.manager@fathom.test`, shown in Fathom as **Product Manager**. It holds the Product Manager role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Feature Lead account:** `feature.lead@fathom.test`, shown in Fathom as **Feature Lead**. It holds the Feature Lead role, as [Roles](../product/roles.md#starting-roles) sets out.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use after R0, before the first test case, and wherever a test case says so. Fathom keeps running. This removes the seed data and every draft of it, including drafts made during the test, then adds the seed data again; it keeps accounts and anything else added by hand.

1. In the second terminal, run:

   ```sh
   pnpm db:reseed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

## Terms

- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown in a row's first cell.
- **⋯ menu:** the menu that opens from the **⋯** button at the end of a row.
- **Column menu:** the menu that opens when you select a column's name in the table's header.
- **Side panel:** the panel on the right that opens from **Show details** in a row's **⋯** menu, headed with the record's name, with its close button, an **×**, at its top right.

## Test Cases

Run the test cases in order. Start with R0, then R1. Check each step whose expected result you see, and write anything else under its notes.

### LINK-01: Projects and Proposals Name a Feature

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Find the row **Offline Sync**, and look at its **Projects** cell.
  - **Expected:** It names **Clinic Booking**, with no ID before it, then **Crane Control**, with **P-2001** in grey before it, separated by a comma.
  - **Notes:**

- [ ] **Step 2.** Look at the **Proposals** cell of **Offline Sync**.
  - **Expected:** It names **Clinic Scheduling Pilot**, with **PR-102** in grey before it, then **Harbour Cranes Upgrade**, with **PR-101** in grey before it.
  - **Notes:**

- [ ] **Step 3.** Point at the **Projects** cell of **Offline Sync**.
  - **Expected:** A tip lists **Clinic Booking** and **P-2001 Crane Control**, each on a line of its own.
  - **Notes:**

- [ ] **Step 4.** Switch Fathom between light and dark mode, and look at the **Projects** and **Proposals** cells.
  - **Expected:** In both modes the grey IDs are easy to read, and are clearly lighter than the names.
  - **Notes:**

### LINK-02: A Project's Details Open on Features

**Account:** Product Manager, `product.manager@fathom.test`, the same as LINK-01.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** Select **Show details** in the **⋯** menu of **Offline Sync**.
  - **Expected:** The side panel lists **Clinic Booking** and **Crane Control** under **Projects**, and **Clinic Scheduling Pilot** and **Harbour Cranes Upgrade** under **Proposals**, each a link on a line of its own, with its ID in grey before it where it has one.
  - **Notes:**

- [ ] **Step 2.** Select **Crane Control** under **Projects**.
  - **Expected:** The page is still titled **Features**, with the table of features in view. The side panel is headed **Crane Control**, listing **Name**, **Project ID**, **Owner**, **Customers**, **Proposals**, **Features**, **First milestone**, **Last milestone** and **Next delivery**, then **Milestones**.
  - **Notes:**

- [ ] **Step 3.** Select **Audit Export** under **Features** in the side panel.
  - **Expected:** The page is still **Features**, and the side panel is headed **Audit Export**.
  - **Notes:**

- [ ] **Step 4.** Select the browser's back button.
  - **Expected:** The side panel shows **Crane Control** again.
  - **Notes:**

- [ ] **Step 5.** Select the browser's back button again, then select **Harbour Cranes Upgrade** under **Proposals**.
  - **Expected:** The page is still **Features**, and the side panel is headed **Harbour Cranes Upgrade**, listing the proposal's **Name**, **Proposal ID**, **Link**, **Owner**, **Customers**, **Status** and **Features**.
  - **Notes:**

- [ ] **Step 6.** Close the side panel.
  - **Expected:** The panel closes, and the table fills the page.
  - **Notes:**

### LINK-03: Changing a Feature's Projects Drafts the Project

**Account:** Product Manager, `product.manager@fathom.test`, the same as LINK-02.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** Select the **Projects** cell of **Bulk Import**, and press Enter.
  - **Expected:** A list of projects opens, with a search box, each project named by its ID, where it has one, then its name, such as **P-1984 Transit Displays**. None is picked.
  - **Notes:**

- [ ] **Step 2.** Pick **P-1984 Transit Displays**, and press Enter.
  - **Expected:** The list closes, and the cell names **Transit Displays**, with **P-1984** in grey before it. **Bulk Import** has no mark.
  - **Notes:**

- [ ] **Step 3.** Select **Projects** in the left-hand menu.
  - **Expected:** **Transit Displays** has a hollow yellow dot and **Draft**. Its **Features** cell names **Bulk Import** and **Data Retention Controls**, and the light green **Live** row under it names **Data Retention Controls** alone.
  - **Notes:**

- [ ] **Step 4.** Select **Features** in the left-hand menu, then **New feature**.
  - **Expected:** The **New feature** panel has no **Projects** or **Proposals** row.
  - **Notes:**

- [ ] **Step 5.** Select **Cancel** in the **New feature** panel.
  - **Expected:** The panel closes.
  - **Notes:**

**Afterwards:** Run R1.

### LINK-04: Show Features Opens Features Filtered

**Account:** Product Manager, `product.manager@fathom.test`, the same as LINK-03.

**Preconditions:** R1 run after LINK-03. **Projects** page open, **Projects** tab chosen.

- [ ] **Step 1.** In the **⋯** menu of **Crane Control**, select **Show features**.
  - **Expected:** The **Features** page opens showing only **Audit Export** and **Offline Sync**, with a pill above the table reading **Projects: P-2001 Crane Control**.
  - **Notes:**

- [ ] **Step 2.** Select the **×** on the pill.
  - **Expected:** Every feature shows again.
  - **Notes:**

- [ ] **Step 3.** Select **Projects** in the left-hand menu, then the **Proposals** tab, and in the **⋯** menu of **Ore Sorting Study**, select **Show features**.
  - **Expected:** The **Features** page opens showing only **Partner Portal**, with a pill reading **Proposals: Ore Sorting Study**.
  - **Notes:**

- [ ] **Step 4.** Select the **×** on the pill, then open the column menu of **Proposals** and select **Filter…**.
  - **Expected:** A list of the proposals opens, each named by its ID, where it has one, then its name.
  - **Notes:**

- [ ] **Step 5.** Select **PR-097 Fleet Tracking Bid**, and press Esc.
  - **Expected:** Only **Data Retention Controls** and **Partner Portal** show, with a pill reading **Proposals: PR-097 Fleet Tracking Bid**.
  - **Notes:**

### LINK-05: The Feature Lead Sees Projects and Proposals Read Only

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from LINK-04.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select the **Projects** cell of **Bulk Import**, and press Enter.
  - **Expected:** No list opens.
  - **Notes:**

- [ ] **Step 2.** Select **Show details** in the **⋯** menu of **Offline Sync**.
  - **Expected:** The side panel shows no pencil button beside **Projects** or **Proposals**, and shows one beside **Name**.
  - **Notes:**
