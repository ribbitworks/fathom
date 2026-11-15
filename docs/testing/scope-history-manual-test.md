---
title: "Manual Test: Scope History"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/design/visual-design.md"]
last_updated: "2026-11-14"
---

# Manual Test: Scope History

## Scope

Verifies a feature's customers and notes in its side panel on the Features page, and the scope history in a project's and a proposal's side panel: the features given to it and taken off it, with the reason for removing a feature from a proposal, added once the removal is drafted, while a draft and once approved. Following the links and changing a feature's projects and proposals are verified in [Feature Links](feature-links-manual-test.md).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`, shown in Fathom as "Product Manager".
- **Feature Lead:** `feature.lead@fathom.test`, shown in Fathom as "Feature Lead".
- **Engineering Director:** `engineering.director@fathom.test`, shown in Fathom as "Engineering Director".

## Common Procedures

[Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Reset the Database](manual-test-basics.md#reset-the-database) and [Publish](manual-test-basics.md#publish), from Manual Test Basics.

## Terms

As [Manual Test Basics](manual-test-basics.md#terms) sets out, and:

- **Scope history:** the list at the foot of a project's or a proposal's side panel, under the heading **Scope history**. Each row names a feature, with a grey line under it saying "Added" or "Removed" and the date, and any reason under that. A draft's row is at the top, with a yellow dot before the feature's name, dated the day it was drafted.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### SCOPE-01: A Feature's Customers and Notes in Its Details

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] `327B` Select **Show details** in the **⋯** menu of 'Offline Sync'.
  - **Expected:**
    - Under the heading **Details**, the rows read, from the top:
      - **Name**
      - **Status**
      - **Description**
      - **Notes**
    - Under the heading **Customers and commitments**, the rows read, from the top:
      - **Customers**
      - **Projects**
      - **Proposals**
    - Under the heading **Planning**, the rows read, from the top:
      - **Priority**
      - **Needed by**
      - **Effort**
      - **Size**
      - **Risk**
      - **Release**
      - **Target cycle**
      - **Feature team**
      - **Staffed**
    - Under the heading **Columns**, the rows read, from the top:
      - **Kind**
    - **Customers** lists these links, each on a line of its own, from the top:
      - 'Bluefin Harbour Authority'
      - 'Cedar Valley Clinics'
  - **Notes:**

- [ ] `2DCD` Select 'Cedar Valley Clinics' under **Customers** in the side panel.
  - **Expected:**
    - The **Projects** page opens on its **Customers** tab.
    - The side panel is headed 'Cedar Valley Clinics'.
  - **Notes:**

- [ ] `0BB2` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `94B7` Select **Show details** in the **⋯** menu of 'Offline Sync'.
  - **Expected:** The side panel opens, headed 'Offline Sync'.
  - **Notes:**

- [ ] `12F6` Select the open button beside **Notes**.
  - **Expected:**
    - A panel titled **Notes for Offline Sync** opens beside the side panel.
    - It shows the note, starting "Field crews asked for this first."
  - **Notes:**

- [ ] `3ECA` Close the **Notes for Offline Sync** panel.
  - **Expected:**
    - The **Notes for Offline Sync** panel closes.
    - The side panel stays open.
  - **Notes:**

### SCOPE-02: A Proposal's and a Project's Scope History

**Account:** Product Manager, `product.manager@fathom.test`, the same as SCOPE-01.

**Preconditions:** **Features** page open, the side panel of 'Offline Sync' open.

- [ ] `C97E` Select 'Harbour Cranes Upgrade' under **Proposals** in the side panel.
  - **Expected:**
    - Under **Scope history**, the entries read, from the top:
      - 'Audit Export'
      - 'Offline Sync'
    - Each entry's name is a link.
    - Under each entry, "Added" and a date show in grey.
  - **Notes:**

- [ ] `F5A4` Select 'Offline Sync' under **Scope history**.
  - **Expected:** The side panel shows 'Offline Sync' again.
  - **Notes:**

- [ ] `FD46` Select 'Crane Control' under **Projects**.
  - **Expected:**
    - Under **Scope history**, after its milestones, the entries read, from the top:
      - 'Audit Export'
      - 'Offline Sync'
    - Under each entry, "Added" and a date show in grey.
  - **Notes:**

- [ ] `D045` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens.
  - **Notes:**

- [ ] `B5EE` Select the **Proposals** tab.
  - **Expected:** The table lists the proposals.
  - **Notes:**

- [ ] `AEEC` Select **Show details** in the **⋯** menu of 'Fleet Tracking Bid'.
  - **Expected:**
    - The first row under **Scope history** names 'Report Builder'.
    - The first row reads "Removed" and a date, in grey.
    - The first row reads "Reason: Reporting dropped from the bid".
    - The first row has no dot.
    - The next three rows name, from the top:
      - 'Data Retention Controls'
      - 'Report Builder'
      - 'Partner Portal'
    - Each of those three rows reads "Added" and a date, in grey.
  - **Notes:**

### SCOPE-03: Taking a Feature off a Proposal Saves at Once

**Account:** Product Manager, `product.manager@fathom.test`, the same as SCOPE-02.

**Preconditions:** **Features** page open.

- [ ] `486B` Select the **Proposals** cell of 'Offline Sync'.
  - **Expected:** The cell is selected.
  - **Notes:**

- [ ] `BFED` Press Enter.
  - **Expected:**
    - A list of proposals opens.
    - These are picked:
      - 'PR-101 Harbour Cranes Upgrade'
      - 'PR-102 Clinic Scheduling Pilot'
  - **Notes:**

- [ ] `B667` Unpick 'PR-101 Harbour Cranes Upgrade'.
  - **Expected:** 'PR-101 Harbour Cranes Upgrade' is no longer picked.
  - **Notes:**

- [ ] `8C47` Press Enter.
  - **Expected:**
    - The list closes.
    - No dialog opens.
    - The **Proposals** cell names 'Clinic Scheduling Pilot' alone.
  - **Notes:**

- [ ] `E3EC` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens.
  - **Notes:**

- [ ] `E8F4` Select the **Proposals** tab.
  - **Expected:** The table lists the proposals.
  - **Notes:**

- [ ] `75DE` Select **Show details** in the **⋯** menu of 'Harbour Cranes Upgrade'.
  - **Expected:**
    - Under **Scope history**, the rows read, from the top:
      - 'Offline Sync'
      - 'Audit Export'
      - 'Offline Sync'
    - The first row's top line holds, from left to right:
      - A hollow yellow dot
      - 'Offline Sync'
    - The first row's next line reads "Removed" and today's date, in grey.
    - The first row shows no reason.
    - A change button is at the first row's right.
    - The second row reads "Added" and a date, in grey.
    - The third row reads "Added" and a date, in grey.
    - No row is struck through.
  - **Notes:**

### SCOPE-04: Giving the Reason After the Removal

**Account:** Product Manager, `product.manager@fathom.test`, the same as SCOPE-03.

**Preconditions:** As SCOPE-03 ends, the side panel of 'Harbour Cranes Upgrade' open.

- [ ] `816B` Select the change button at the right of the first row under **Scope history**.
  - **Expected:**
    - An empty box opens under "Removed" and today's date.
    - The cursor is in the box.
    - The change button is gone.
  - **Notes:**

- [ ] `CBD4` Type `Customer chose another supplier`, and press Enter.
  - **Expected:**
    - The box closes.
    - The first row's last line reads "Reason: Customer chose another supplier".
    - The keyboard focus is on the change button at the first row's right.
  - **Notes:**

- [ ] `3EB2` Select the line "Reason: Customer chose another supplier".
  - **Expected:**
    - The box opens, holding `Customer chose another supplier`.
    - The cursor is in the box.
  - **Notes:**

- [ ] `27DC` Clear the box, and type `x`.
  - **Expected:** The box holds `x`.
  - **Notes:**

- [ ] `321C` Press Esc.
  - **Expected:**
    - The box closes.
    - The first row's last line reads "Reason: Customer chose another supplier".
  - **Notes:**

- [ ] `D346` Select the change button at the right of the first row.
  - **Expected:** The box opens, holding `Customer chose another supplier`.
  - **Notes:**

- [ ] `D4A3` Clear the box, and type `Customer delayed the upgrade`.
  - **Expected:** The box holds `Customer delayed the upgrade`.
  - **Notes:**

- [ ] `D77B` Select the heading **Scope history**.
  - **Expected:**
    - The box closes.
    - The first row's last line reads "Reason: Customer delayed the upgrade".
  - **Notes:**

### SCOPE-05: Removing a Feature from a Proposal's Details, with No Reason

**Account:** Product Manager, `product.manager@fathom.test`, the same as SCOPE-04.

**Preconditions:** **Projects** page open, **Proposals** tab chosen.

- [ ] `958D` Select **Show details** in the **⋯** menu of 'Clinic Scheduling Pilot'.
  - **Expected:** The side panel opens, headed 'Clinic Scheduling Pilot'.
  - **Notes:**

- [ ] `C4EF` Select the change button beside **Features** in the side panel.
  - **Expected:**
    - A list of features opens.
    - These are picked:
      - 'Offline Sync'
      - 'Scheduler API'
  - **Notes:**

- [ ] `5DCB` Unpick 'Scheduler API'.
  - **Expected:** 'Scheduler API' is no longer picked.
  - **Notes:**

- [ ] `6B38` Press Enter.
  - **Expected:**
    - No dialog opens.
    - **Features** in the side panel names 'Offline Sync' alone.
    - The first row under **Scope history** names 'Scheduler API'.
    - The first row has a hollow yellow dot before 'Scheduler API'.
    - The first row reads "Removed" and today's date, in grey.
    - The first row shows no reason.
  - **Notes:**

- [ ] `947E` Open the Draft menu, and select **Live only**.
  - **Expected:**
    - No row has a yellow dot.
    - No row reads "Removed".
  - **Notes:**

- [ ] `735D` Select **Drafts & Live**.
  - **Expected:**
    - The 'Scheduler API' row reading "Removed" is back at the top.
    - It has a hollow yellow dot before 'Scheduler API'.
  - **Notes:**

- [ ] `EB88` Run Publish.
  - **Expected:** The dot before 'Scheduler API' is now solid yellow.
  - **Notes:**

### SCOPE-06: The Feature Lead Sees the Reason Without Changing It

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from SCOPE-05.

**Preconditions:** Signed in with this account. **Projects** page open, **Proposals** tab chosen.

- [ ] `FBF0` Select **Show details** in the **⋯** menu of 'Harbour Cranes Upgrade'.
  - **Expected:**
    - The first row under **Scope history** reads "Reason: Customer delayed the upgrade".
    - It has no change button.
  - **Notes:**

### SCOPE-07: An Approved Removal Is Dated, with Its Reason

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from SCOPE-06.

**Preconditions:** Signed in with this account. **Projects** page open, **Proposals** tab chosen.

- [ ] `60CA` In the **⋯** menu of 'Harbour Cranes Upgrade', select **Approve…**.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `B5E4` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - The row has no dot.
  - **Notes:**

- [ ] `93BF` Select **Show details** in the **⋯** menu of 'Harbour Cranes Upgrade'.
  - **Expected:**
    - Under **Scope history**, the rows read, from the top:
      - 'Offline Sync'
      - 'Audit Export'
      - 'Offline Sync'
    - The first row has no dot.
    - The first row reads "Removed" and today's date, in grey.
    - The first row reads "Reason: Customer delayed the upgrade".
    - The first row has no change button.
  - **Notes:**

- [ ] `A22D` Select the **Change history** page in the left-hand menu.
  - **Expected:**
    - The newest entry reads "Engineering Director as Engineering Director approved changes to the proposal Harbour Cranes Upgrade".
    - After a colon, its details read, dimmed, in this order:
      - "Features from Audit Export, Offline Sync to Audit Export"
      - "Reasons for removing features set to Offline Sync: Customer delayed the upgrade"
  - **Notes:**

**Afterwards:** Run Reset the Database.
