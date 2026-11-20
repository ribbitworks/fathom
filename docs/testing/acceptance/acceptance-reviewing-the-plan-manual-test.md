---
title: "Manual Test: Acceptance, Reviewing the Plan"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/acceptance/acceptance-planning-features-and-a-release-manual-test.md", "docs/help/working-as-a-project-manager.md", "docs/help/drafts-page.md", "docs/product/roles.md"]
last_updated: "2026-11-20"
---

# Manual Test: Acceptance, Reviewing the Plan

## Scope

Verifies that a Project Manager decides a Product Manager's first plan and keeps a project on track, as [Working as a Project Manager](../../help/working-as-a-project-manager.md) describes, on the plan [Planning Features and a Release](acceptance-planning-features-and-a-release-manual-test.md) published: the release is rejected with a reason, everything else is approved in one pass, and the Project Manager then adds a milestone, reads the project's scope history and goes from the project to its features.

## Test Environment

What [Planning Features and a Release](acceptance-planning-features-and-a-release-manual-test.md) left, run straight after it: Fathom running on its installation, at `https://localhost:10443`, in a browser window at least 1,440 pixels wide.

## Test Accounts

[The Team's Accounts](acceptance-team-accounts-manual-test.md) made this account:

- **Project Manager:** `tomas.reed@fathom.test`, shown in Fathom as `Tomas Reed`, with the password `fictional tomas password`

## Common Procedures

This test uses [Publish](../manual-test-basics.md#publish). [Start Again](../manual-test-basics.md#start-again) removes the installation, for a fresh run from [Installing Fathom](acceptance-installing-fathom-manual-test.md).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses, such as marks, a row's slot, the tick box, the side panel, the details button and the ⋯ menu. This test adds:

- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20300901`.

## Test Cases

Run the test cases in order, in about 20 minutes, straight after [Planning Features and a Release](acceptance-planning-features-and-a-release-manual-test.md). Check each step whose expected result you see, and write anything else under its notes.

### REVIEW-01: The Release Is Rejected With a Reason

**Account:** Project Manager, `tomas.reed@fathom.test`, changed from FEAT-05 in [Planning Features and a Release](acceptance-planning-features-and-a-release-manual-test.md); the first test case. The first step signs in as this account.

**Preconditions:** [Planning Features and a Release](acceptance-planning-features-and-a-release-manual-test.md) run just before.

- [ ] `B45C` Sign out from the account menu, and sign in as the Project Manager, `tomas.reed@fathom.test`, with the password `fictional tomas password`.
  - **Expected:** The top bar's right end shows `Tomas Reed`.
  - **Notes:**

- [ ] `13AA` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - Thirteen rows are shown, each with a tick box and **Made by** "Priya Lund as Product Manager":
      - "Fictional Spring in Fictional Mainline", with **Type** "Release"
      - the three customers, the three projects, the three features, the proposal, and the two milestones of `Fictional Lamp Room`
  - **Notes:**

- [ ] `5C64` Type `Fictional Spring` in the search box.
  - **Expected:** One row is shown, whose **Record** reads "Fictional Spring in Fictional Mainline".
  - **Notes:**

- [ ] `A10A` Tick that row's tick box.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `3B96` Select **Reject…** at the right of the page's heading.
  - **Expected:** A dialog titled "Reject 1 draft?" opens, with a **Reason** box.
  - **Notes:**

- [ ] `3F40` Type `Fictional reason: ship it at the end of the second cycle.` in **Reason**.
  - **Expected:** **Reason** shows what was typed.
  - **Notes:**

- [ ] `F797` Select **Reject**.
  - **Expected:**
    - A notification says "Rejected 1 draft."
    - The table reads "No matching drafts".
  - **Notes:**

### REVIEW-02: The Rest of the Plan Is Approved in One Pass

**Account:** Project Manager, `tomas.reed@fathom.test`, the same as REVIEW-01.

**Preconditions:** REVIEW-01 done. **Drafts** page open.

- [ ] `F7A5` Clear the search box.
  - **Expected:** Every waiting draft is listed, and `Fictional Spring` is not among them.
  - **Notes:**

- [ ] `D8A1` Tick the tick box before **Record** in the table's header.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 12 drafts…**.
  - **Notes:**

- [ ] `E7B9` Select **Approve 12 drafts…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 12 drafts?" opens.
  - **Notes:**

- [ ] `F3AE` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 12 drafts."
    - The table reads "No drafts".
  - **Notes:**

- [ ] `0B7F` Select **All drafts** beside the page's title.
  - **Expected:** One row is shown, "Fictional Spring in Fictional Mainline", whose **State** reads "Rejected" and whose **Reason** reads "Fictional reason: ship it at the end of the second cycle."
  - **Notes:**

### REVIEW-03: A Project Is Kept on Track

**Account:** Project Manager, `tomas.reed@fathom.test`, the same as REVIEW-02.

**Preconditions:** REVIEW-02 done.

- [ ] `EE07` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** tab lists `Fictional Lamp Room`, `Fictional Tide Gauge` and `Fictional Pier Lights`, with no dots.
  - **Notes:**

- [ ] `D3C8` Select the details button at the right of the **Name** cell of `Fictional Lamp Room`.
  - **Expected:**
    - The side panel is headed `Fictional Lamp Room`.
    - **Customers** shows `Fictional Ferry Co-op`.
    - Under **Milestones**, `Lamp trial` and `Lamps lit`.
    - Under **Scope history**, `Fictional Tide Tables` and `Fictional Lamp Schedule`, each followed by "Added" and today's date, with no dots.
  - **Notes:**

- [ ] `F58C` Select **Add milestone**.
  - **Expected:** A dialog titled "New milestone" opens.
  - **Notes:**

- [ ] `96CF` Type `Keepers trained` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `DA6C` Type `20300901` in **Date**.
  - **Expected:** **Date** shows the date typed.
  - **Notes:**

- [ ] `559C` Tick **Customer delivery**.
  - **Expected:** **Customer delivery** is ticked.
  - **Notes:**

- [ ] `9E0E` Select **Add milestone** in the dialog.
  - **Expected:**
    - `Keepers trained` is listed after `Lamps lit`, with a hollow yellow dot before it.
    - **Last milestone** shows "2030-09-01".
  - **Notes:**

- [ ] `D24D` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

### REVIEW-04: The Project's Features Are Found From It

**Account:** Project Manager, `tomas.reed@fathom.test`, the same as REVIEW-03.

**Preconditions:** REVIEW-03 done. **Projects** page open, on the **Projects** tab.

- [ ] `EBBA` Select **Show features** in the ⋯ menu of `Fictional Lamp Room`.
  - **Expected:**
    - The **Features** page opens showing only `Fictional Tide Tables` and `Fictional Lamp Schedule`.
    - A pill above the table reads "Projects: FLR-1 Fictional Lamp Room".
  - **Notes:**

- [ ] `EB97` Select the **×** on the pill.
  - **Expected:** The pill is gone, and the table lists the three features.
  - **Notes:**

**Afterwards:** Run [Staffing the Work](acceptance-staffing-the-work-manual-test.md) next, on this installation. To stop here instead, run [Start Again](../manual-test-basics.md#start-again).
