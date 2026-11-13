---
title: "Manual Test: Feature Links"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-13"
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

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### LINK-01: Projects and Proposals Name a Feature

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] `6F72` Find the row 'Offline Sync', and look at its **Projects** cell.
  - **Expected:**
    - It names 'Clinic Booking Rollout' first.
    - No ID is before 'Clinic Booking Rollout'.
    - Then 'Crane Control'.
    - 'P-2001' is in grey before 'Crane Control'.
    - A comma separates the two.
  - **Notes:**

- [ ] `92BE` Look at the **Proposals** cell of 'Offline Sync'.
  - **Expected:**
    - It names 'Clinic Scheduling Pilot' first.
    - 'PR-102' is in grey before 'Clinic Scheduling Pilot'.
    - Then 'Harbour Cranes Upgrade'.
    - 'PR-101' is in grey before 'Harbour Cranes Upgrade'.
  - **Notes:**

- [ ] `5A96` Point at the **Projects** cell of 'Offline Sync'.
  - **Expected:** A tip lists 'Clinic Booking Rollout' and 'P-2001 Crane Control', each on a line of its own.
  - **Notes:**

- [ ] `E3B8` Look at the **Projects** and **Proposals** cells of 'Offline Sync'.
  - **Expected:**
    - The grey IDs are easy to read.
    - They are clearly lighter than the names.
  - **Notes:**

### LINK-02: A Project's Details Open on Features

**Account:** Product Manager, `product.manager@fathom.test`, the same as LINK-01.

**Preconditions:** **Features** page open.

- [ ] `412D` Select **Show details** in the **⋯** menu of 'Offline Sync'.
  - **Expected:**
    - The side panel lists 'Clinic Booking Rollout' and 'Crane Control' under **Projects**.
    - It lists 'Clinic Scheduling Pilot' and 'Harbour Cranes Upgrade' under **Proposals**.
    - Each name is a link on a line of its own.
    - Each name has its ID in grey before it, where it has one.
  - **Notes:**

- [ ] `FD1E` Select 'Crane Control' under **Projects**.
  - **Expected:**
    - The page is still titled **Features**.
    - The table of features is in view.
    - The side panel is headed 'Crane Control'.
    - The side panel lists, from the top:
      - **Name**
      - **Project ID**
      - **Owner**
      - **Customers**
      - **Proposals**
      - **Features**
      - **First milestone**
      - **Last milestone**
      - **Next delivery**
      - **Milestones**
  - **Notes:**

- [ ] `FD3D` Select 'Audit Export' under **Features** in the side panel.
  - **Expected:**
    - The page is still **Features**.
    - The side panel is headed 'Audit Export'.
  - **Notes:**

- [ ] `6A45` Select the browser's back button.
  - **Expected:** The side panel shows 'Crane Control' again.
  - **Notes:**

- [ ] `CDEC` Select the browser's back button again.
  - **Expected:** The side panel shows 'Offline Sync' again.
  - **Notes:**

- [ ] `B2E4` Select 'Harbour Cranes Upgrade' under **Proposals**.
  - **Expected:**
    - The page is still **Features**.
    - The side panel is headed 'Harbour Cranes Upgrade'.
    - The side panel lists the proposal's:
      - **Name**
      - **Proposal ID**
      - **Link**
      - **Owner**
      - **Customers**
      - **Status**
      - **Features**
  - **Notes:**

- [ ] `32BC` Close the side panel.
  - **Expected:**
    - The panel closes.
    - The table fills the page.
  - **Notes:**

### LINK-03: Changing a Feature's Projects Drafts the Project

**Account:** Product Manager, `product.manager@fathom.test`, the same as LINK-02.

**Preconditions:** **Features** page open.

- [ ] `220E` Select the **Projects** cell of 'Bulk Import', and press Enter.
  - **Expected:**
    - A list of projects opens.
    - It has a search box.
    - Each project is named by its ID, where it has one, then its name, such as 'P-2001 Crane Control'.
    - None is picked.
  - **Notes:**

- [ ] `34B4` Pick 'Internal Tools', and press Enter.
  - **Expected:**
    - The list closes.
    - The cell names 'Internal Tools'.
    - 'Bulk Import' has no dot.
  - **Notes:**

- [ ] `59FB` Select the **Projects** page in the left-hand menu.
  - **Expected:** In the row 'Internal Tools':
    - Its **Features** cell names 'Bulk Import' and 'Usage Alerts'.
    - A hollow yellow dot is before them.
    - The light green Live row under it names 'Usage Alerts' alone in its **Features** cell.
  - **Notes:**

- [ ] `A6DC` Select the **Features** page in the left-hand menu.
  - **Expected:** The page is titled **Features**.
  - **Notes:**

- [ ] `66AE` Select **New feature**.
  - **Expected:** The **New feature** panel has no **Projects** or **Proposals** row.
  - **Notes:**

- [ ] `2D1E` Select **Cancel** in the **New feature** panel.
  - **Expected:** The panel closes.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### LINK-04: Show Features Opens Features Filtered

**Account:** Product Manager, `product.manager@fathom.test`, the same as LINK-03.

**Preconditions:** Restore the Seed Data run after LINK-03. **Projects** page open, **Projects** tab chosen.

- [ ] `865B` In the **⋯** menu of 'Crane Control', select **Show features**.
  - **Expected:**
    - The **Features** page opens.
    - Only 'Audit Export' and 'Offline Sync' show.
    - A pill above the table reads "Projects: P-2001 Crane Control".
  - **Notes:**

- [ ] `A3F9` Select the **×** on the pill.
  - **Expected:** Every feature shows again.
  - **Notes:**

- [ ] `DFE4` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens.
  - **Notes:**

- [ ] `E48B` Select the **Proposals** tab.
  - **Expected:**
    - The table lists proposals.
    - 'Ore Sorting Study' is among them.
  - **Notes:**

- [ ] `E2BD` In the **⋯** menu of 'Ore Sorting Study', select **Show features**.
  - **Expected:**
    - The **Features** page opens.
    - Only 'Partner Portal' shows.
    - A pill reads "Proposals: Ore Sorting Study".
  - **Notes:**

- [ ] `64B8` Select the **×** on the pill.
  - **Expected:** Every feature shows again.
  - **Notes:**

- [ ] `D6F7` Open the column menu of **Proposals**, and select **Filter…**.
  - **Expected:**
    - A list of the proposals opens.
    - Each is named by its ID, where it has one, then its name.
  - **Notes:**

- [ ] `471B` Select 'PR-097 Fleet Tracking Bid'.
  - **Expected:** 'PR-097 Fleet Tracking Bid' is picked.
  - **Notes:**

- [ ] `A59D` Press Esc.
  - **Expected:**
    - Only 'Data Retention Controls' and 'Partner Portal' show.
    - A pill reads "Proposals: PR-097 Fleet Tracking Bid".
  - **Notes:**

### LINK-05: The Feature Lead Sees Projects and Proposals Read Only

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from LINK-04.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] `49BB` Select the **Projects** cell of 'Bulk Import', and press Enter.
  - **Expected:** No list opens.
  - **Notes:**

- [ ] `A1E8` Select **Show details** in the **⋯** menu of 'Offline Sync'.
  - **Expected:**
    - The side panel shows no pencil button beside **Projects** or **Proposals**.
    - It shows one beside **Name**.
  - **Notes:**
