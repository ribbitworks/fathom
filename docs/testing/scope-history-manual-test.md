---
title: "Manual Test: Scope History"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Scope History

## Scope

Verifies a feature's customers and notes in its side panel on the Features page, and the scope history in a project's and a proposal's side panel: the features given to it and taken off it, with the reason given for removing a feature from a proposal, while a draft and once approved. Following the links and changing a feature's projects and proposals are verified in [Feature Links](feature-links-manual-test.md).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`, shown in Fathom as **Product Manager**.
- **Feature Lead:** `feature.lead@fathom.test`, shown in Fathom as **Feature Lead**.
- **Engineering Director:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**.

## Common Procedures

[Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Reset the Database](manual-test-basics.md#reset-the-database) and [Publish](manual-test-basics.md#publish), from Manual Test Basics.

## Terms

As [Manual Test Basics](manual-test-basics.md#terms) sets out, and:

- **Scope history:** the list at the foot of a project's or a proposal's side panel, under the heading **Scope history**. Each row names a feature, with a grey line under it saying **Added** or **Removed** and the date, and any reason under that. A draft's row is at the top, marked **Draft**, dated the day it was drafted.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### SCOPE-01: A Feature's Customers and Notes in Its Details

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] **Step 1.** Select **Show details** in the **⋯** menu of **Offline Sync**.
  - **Expected:**
    - The side panel's sections are as [Features](features-manual-test.md) checks them.
    - **Customers** lists these links, each on a line of its own, from the top:
      - Bluefin Harbour Authority
      - Cedar Valley Clinics
  - **Notes:**

- [ ] **Step 2.** Select **Cedar Valley Clinics** under **Customers** in the side panel.
  - **Expected:**
    - The **Projects** page opens on its **Customers** tab.
    - The side panel is headed **Cedar Valley Clinics**.
  - **Notes:**

- [ ] **Step 3.** Select the **Features** page in the left-hand menu, select **Show details** in the **⋯** menu of **Offline Sync**, and select the pencil button beside **Notes**.
  - **Expected:**
    - A panel titled **Notes for Offline Sync** opens beside the side panel.
    - It shows the note, starting **Field crews asked for this first.**
  - **Notes:**

- [ ] **Step 4.** Close the **Notes for Offline Sync** panel, then switch Fathom between light and dark mode.
  - **Expected:**
    - In both modes the four section headings are easy to read.
    - In both modes the headings stand apart from the rows under them.
  - **Notes:**

### SCOPE-02: A Proposal's and a Project's Scope History

**Account:** Product Manager, `product.manager@fathom.test`, the same as SCOPE-01.

**Preconditions:** **Features** page open, the side panel of **Offline Sync** open.

- [ ] **Step 1.** Select **Harbour Cranes Upgrade** under **Proposals** in the side panel, and look under **Scope history**.
  - **Expected:**
    - Under **Scope history**, the entries read, from the top:
      - Audit Export
      - Offline Sync
    - Each entry's name is a link.
    - Under each entry, **Added** and a date show in grey.
  - **Notes:**

- [ ] **Step 2.** Select **Offline Sync** under **Scope history**.
  - **Expected:** The side panel shows **Offline Sync** again.
  - **Notes:**

- [ ] **Step 3.** Select **Crane Control** under **Projects**, and look under **Scope history**, after its milestones.
  - **Expected:**
    - Under **Scope history**, the entries read, from the top:
      - Audit Export
      - Offline Sync
    - Under each entry, **Added** and a date show in grey.
  - **Notes:**

- [ ] **Step 4.** Select the **Projects** page in the left-hand menu, then the **Proposals** tab, and select **Show details** in the **⋯** menu of **Fleet Tracking Bid**.
  - **Expected:**
    - The first row under **Scope history** names **Report Builder**.
    - The first row reads **Removed** and a date, in grey.
    - The first row reads **Reason: Reporting dropped from the bid**.
    - The first row has no mark.
    - The next three rows name, from the top:
      - Data Retention Controls
      - Report Builder
      - Partner Portal
    - Each of those three rows reads **Added** and a date, in grey.
  - **Notes:**

### SCOPE-03: Taking a Feature off a Proposal Asks for a Reason

**Account:** Product Manager, `product.manager@fathom.test`, the same as SCOPE-02.

**Preconditions:** **Features** page open.

- [ ] **Step 1.** Select the **Proposals** cell of **Offline Sync**, and press Enter.
  - **Expected:**
    - A list of proposals opens.
    - These are picked:
      - PR-101 Harbour Cranes Upgrade
      - PR-102 Clinic Scheduling Pilot
  - **Notes:**

- [ ] **Step 2.** Unpick **PR-101 Harbour Cranes Upgrade**, and press Enter.
  - **Expected:**
    - A dialog titled **Reason for the removal** opens.
    - It reads **Offline Sync is removed from Harbour Cranes Upgrade.**
    - Its box is labelled **Reason (optional)**.
    - The cursor is in the **Reason (optional)** box.
    - Its buttons read, from left to right:
      - Cancel
      - Save
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:**
    - The dialog closes.
    - The **Proposals** cell of **Offline Sync** still names both proposals.
  - **Notes:**

- [ ] **Step 4.** Repeat steps 1 and 2, type `x` in **Reason (optional)**, and press Esc.
  - **Expected:**
    - A dialog titled **Discard the reason?** opens.
    - Its buttons read, from left to right:
      - Keep writing
      - Discard
  - **Notes:**

- [ ] **Step 5.** Select **Discard**.
  - **Expected:**
    - Both dialogs close.
    - The **Proposals** cell of **Offline Sync** still names both proposals.
    - The keyboard focus is back on the **Proposals** cell of **Offline Sync**.
  - **Notes:**

- [ ] **Step 6.** Repeat steps 1 and 2, type `Customer chose another supplier` in **Reason (optional)**, and press Enter.
  - **Expected:**
    - The dialog closes.
    - The **Proposals** cell names **Clinic Scheduling Pilot** alone.
  - **Notes:**

- [ ] **Step 7.** Select the **Projects** page in the left-hand menu, then the **Proposals** tab, and select **Show details** in the **⋯** menu of **Harbour Cranes Upgrade**.
  - **Expected:**
    - Under **Scope history**, the rows read, from the top:
      - Offline Sync
      - Audit Export
      - Offline Sync
    - The first row's top line holds, from left to right:
      - A hollow yellow dot and **Draft**
      - **Offline Sync**
    - The first row's next line reads **Removed** and today's date, in grey.
    - The first row's last line reads **Reason: Customer chose another supplier**.
    - A **Change reason** button, with an outline, is at the first row's right.
    - The second row reads **Added** and a date, in grey.
    - The third row reads **Added** and a date, in grey.
    - No row is struck through.
  - **Notes:**

### SCOPE-04: Changing the Reason While the Removal Is a Draft

**Account:** Product Manager, `product.manager@fathom.test`, the same as SCOPE-03.

**Preconditions:** As SCOPE-03 ends, the side panel of **Harbour Cranes Upgrade** open.

- [ ] **Step 1.** Select **Change reason** in the first row under **Scope history**.
  - **Expected:**
    - A dialog titled **Change the reason for the removal** opens.
    - **Reason (optional)** holds **Customer chose another supplier**.
    - Its buttons read, from left to right:
      - Cancel
      - Save
  - **Notes:**

- [ ] **Step 2.** Replace the reason with `Customer delayed the upgrade`, and select **Save**.
  - **Expected:** The first row under **Scope history** reads **Reason: Customer delayed the upgrade**.
  - **Notes:**

### SCOPE-05: Removing a Feature from a Proposal's Details, with No Reason

**Account:** Product Manager, `product.manager@fathom.test`, the same as SCOPE-04.

**Preconditions:** **Projects** page open, **Proposals** tab chosen.

- [ ] **Step 1.** Select **Show details** in the **⋯** menu of **Cabin Wi-Fi Refresh**, then the pencil button beside **Features** in the side panel.
  - **Expected:**
    - A list of features opens.
    - These are picked:
      - Mobile Approvals
      - Voice Notes
  - **Notes:**

- [ ] **Step 2.** Unpick **Voice Notes**, and press Enter.
  - **Expected:**
    - The **Reason for the removal** dialog opens.
    - It reads **Voice Notes is removed from Cabin Wi-Fi Refresh.**
  - **Notes:**

- [ ] **Step 3.** Type `x` in **Reason (optional)**, then select the **×** at the right of the box.
  - **Expected:** The box is empty.
  - **Notes:**

- [ ] **Step 4.** Select **Save**.
  - **Expected:**
    - The dialog closes.
    - **Features** in the side panel names **Mobile Approvals** alone.
  - **Notes:**

- [ ] **Step 5.** Look under **Scope history** in the side panel.
  - **Expected:**
    - The first row under **Scope history** names **Voice Notes**.
    - The first row has a hollow yellow dot and **Draft**.
    - The first row reads **Removed** and today's date, in grey.
    - The first row shows no reason.
  - **Notes:**

- [ ] **Step 6.** Open the Draft menu, and select **Live only**.
  - **Expected:**
    - No row has a **Draft** mark.
    - No row reads **Removed**.
  - **Notes:**

- [ ] **Step 7.** Select **Drafts beside live**, then run Publish.
  - **Expected:**
    - The **Voice Notes** row reading **Removed** is back at the top.
    - Its **Draft** mark has a filled yellow dot.
  - **Notes:**

### SCOPE-06: The Feature Lead Sees the Reason Without Changing It

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from SCOPE-05.

**Preconditions:** Signed in with this account. **Projects** page open, **Proposals** tab chosen.

- [ ] **Step 1.** Select **Show details** in the **⋯** menu of **Harbour Cranes Upgrade**.
  - **Expected:**
    - The first row under **Scope history** reads **Reason: Customer delayed the upgrade**.
    - It has no **Change reason** button.
  - **Notes:**

### SCOPE-07: An Approved Removal Is Dated, with Its Reason

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from SCOPE-06.

**Preconditions:** Signed in with this account. **Projects** page open, **Proposals** tab chosen.

- [ ] **Step 1.** In the **⋯** menu of **Harbour Cranes Upgrade**, select **Approve…**, then **Approve** in the dialog.
  - **Expected:**
    - A notification says **Approved 1 draft.**
    - The row has no mark.
  - **Notes:**

- [ ] **Step 2.** Select **Show details** in the **⋯** menu of **Harbour Cranes Upgrade**.
  - **Expected:**
    - Under **Scope history**, the rows read, from the top:
      - Offline Sync
      - Audit Export
      - Offline Sync
    - The first row has no mark.
    - The first row reads **Removed** and today's date, in grey.
    - The first row reads **Reason: Customer delayed the upgrade**.
    - The first row has no **Change reason** button.
  - **Notes:**

- [ ] **Step 3.** Select the **Change history** page in the left-hand menu.
  - **Expected:**
    - The newest entry, the approval, names **Harbour Cranes Upgrade**.
    - It shows **Reasons for removing features** set to **Offline Sync: Customer delayed the upgrade**.
  - **Notes:**

**Afterwards:** Run Reset the Database, since the seed data cannot be restored once its drafts are approved.
