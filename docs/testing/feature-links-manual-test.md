---
title: "Manual Test: Feature Links"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Feature Links

## Scope

Verifies the projects and proposals that name a feature on the Features page: how they read, following them to their details beside Features, changing them as drafts of each project and proposal, Show features in a project's and a proposal's menu, filtering by them, and who may change them. The rest of the Features page is verified in [Features](features-manual-test.md).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms this test uses.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Check each step whose expected result you see, and write anything else under its notes.

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

- [ ] **Step 3.** Select the **Projects** page in the left-hand menu.
  - **Expected:** **Transit Displays** has a hollow yellow dot and **Draft**. Its **Features** cell names **Bulk Import** and **Data Retention Controls**, and the light green **Live** row under it names **Data Retention Controls** alone.
  - **Notes:**

- [ ] **Step 4.** Select the **Features** page in the left-hand menu, then **New feature**.
  - **Expected:** The **New feature** panel has no **Projects** or **Proposals** row.
  - **Notes:**

- [ ] **Step 5.** Select **Cancel** in the **New feature** panel.
  - **Expected:** The panel closes.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### LINK-04: Show Features Opens Features Filtered

**Account:** Product Manager, `product.manager@fathom.test`, the same as LINK-03.

**Preconditions:** Restore the Seed Data run after LINK-03. **Projects** page open, **Projects** tab chosen.

- [ ] **Step 1.** In the **⋯** menu of **Crane Control**, select **Show features**.
  - **Expected:** The **Features** page opens showing only **Audit Export** and **Offline Sync**, with a pill above the table reading **Projects: P-2001 Crane Control**.
  - **Notes:**

- [ ] **Step 2.** Select the **×** on the pill.
  - **Expected:** Every feature shows again.
  - **Notes:**

- [ ] **Step 3.** Select the **Projects** page in the left-hand menu, then the **Proposals** tab, and in the **⋯** menu of **Ore Sorting Study**, select **Show features**.
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
