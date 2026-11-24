---
title: "Manual Test: Activities"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/pages/projects.md"]
last_updated: "2026-11-24"
---

# Manual Test: Activities

## Scope

Verifies a project's activities on the Projects page: listed in its details and its table, added from its details, opened in details of their own, changed, removed, and approved as drafts.

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

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, the ⋯ menu and the side panel. This test adds:

- **Activities section:** the section headed **Activities** in a project's side panel, after its milestones.
- **Activity panel:** the side panel that opens under a project's side panel, headed with an activity's name, or **New activity** while one is being added.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again, start from Reset the Database, since the activity it adds stays once approved.

### ACT-01: A Team Member Sees a Project's Activities

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** Restore the Seed Data run, then signed in with this account.

- [ ] `7409` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Activities** column of 'Crane Control' reads "Data migration, General, Operator training", or as much of it as fits.
  - **Notes:**

- [ ] `A2B9` Point at the **Activities** cell of 'Crane Control'.
  - **Expected:** A tip lists 'Data migration', 'General' and 'Operator training', one to a line.
  - **Notes:**

- [ ] `8A64` Open the ⋯ menu of 'Crane Control' and select **Show details**.
  - **Expected:**
    - The side panel's **Activities** section lists 'Data migration', 'General' and 'Operator training', each a link.
    - Under 'Data migration', a line reads "Total effort: 640 hours".
    - There is no **Add activity** button.
  - **Notes:**

- [ ] `17EF` Select 'Data migration' in the **Activities** section.
  - **Expected:**
    - The activity panel opens under the project's side panel, headed **Data migration**, with its key, such as **#ACTIVITY-2**, under the heading.
    - It lists **Name**, **Project**, **Description**, **Total effort** and **Notes**.
    - **Project** reads 'P-2001 Crane Control', as a link.
    - No value has a pencil.
  - **Notes:**

### ACT-02: The Product Manager Adds an Activity

**Account:** Product Manager, `product.manager@fathom.test`, changed from ACT-01.

**Preconditions:** Signed in with this account. **Projects** page open, with the side panel of 'Crane Control' open.

- [ ] `AEB3` In the **Activities** section, select **Add activity**.
  - **Expected:**
    - The activity panel opens headed **New activity**, under the project's side panel.
    - Its **Project** reads 'P-2001 Crane Control'.
    - The cursor is in **Name**.
  - **Notes:**

- [ ] `473B` Select **Cancel**.
  - **Expected:**
    - The activity panel closes, with no question asked.
    - **Add activity** has focus.
  - **Notes:**

- [ ] `A649` Select **Add activity** again.
  - **Expected:** The activity panel opens headed **New activity**.
  - **Notes:**

- [ ] `EEFF` Select **Add** without typing anything.
  - **Expected:**
    - "Name needed" shows in red under **Name**.
    - The **Activities** section is unchanged.
  - **Notes:**

- [ ] `C7E4` Type `General` in **Name**.
  - **Expected:** **Name** reads `General`, and "Name needed" is gone.
  - **Notes:**

- [ ] `21FD` Select **Add**.
  - **Expected:**
    - A notification says "This project already has an activity with that name".
    - **Name** still reads `General`.
    - The **Activities** section is unchanged.
  - **Notes:**

- [ ] `D636` Select **Cancel**.
  - **Expected:** A dialog asks "Discard the new activity?", with **Keep adding** and **Discard**.
  - **Notes:**

- [ ] `D7F1` Select **Keep adding**.
  - **Expected:** The dialog closes, and **Name** still reads `General`.
  - **Notes:**

- [ ] `102B` Clear **Name** and type `Go-live support`.
  - **Expected:** **Name** reads `Go-live support`.
  - **Notes:**

- [ ] `EFE7` Type `80` in **Total effort**.
  - **Expected:** **Total effort** reads `80`.
  - **Notes:**

- [ ] `E3CE` Select **Add**.
  - **Expected:**
    - The activity panel shows the details of 'Go-live support', with a hollow dot before its name.
    - The **Activities** section lists 'Go-live support' with a hollow dot, and "Total effort: 80 hours" under it.
  - **Notes:**

- [ ] `65EE` In the activity panel, select the pencil beside **Description**.
  - **Expected:** **Description** opens for typing.
  - **Notes:**

- [ ] `8B03` Type `Stay on site for the first week` and press Enter.
  - **Expected:** **Description** reads "Stay on site for the first week", with a hollow dot before it.
  - **Notes:**

- [ ] `FE2C` Close the activity panel with the **×** at its top right.
  - **Expected:**
    - The activity panel closes, and the project's side panel stays open.
    - The link 'Go-live support' in the **Activities** section has focus.
  - **Notes:**

- [ ] `2EB0` Run Publish.
  - **Expected:** The dot before 'Go-live support' is yellow.
  - **Notes:**

### ACT-03: The Product Manager Removes an Activity

**Account:** Product Manager, `product.manager@fathom.test`, the same as ACT-02.

**Preconditions:** **Projects** page open, with the side panel of 'Crane Control' open.

- [ ] `E5DB` Open the ⋯ menu of 'General' in the **Activities** section, and select **Remove activity**.
  - **Expected:** A notification says "The activity General of Crane Control has allocations, so it can't be removed. Allocations are time spent, so the activity stays."
  - **Notes:**

- [ ] `581B` Open the ⋯ menu of 'Operator training' in the **Activities** section, and select **Remove activity**.
  - **Expected:** 'Operator training' is struck through, with a hollow dot before it.
  - **Notes:**

- [ ] `8279` Run Publish.
  - **Expected:** The dot before 'Operator training' is yellow.
  - **Notes:**

### ACT-04: The Project Manager Approves the Drafts

**Account:** Project Manager, `project.manager@fathom.test`, changed from ACT-03.

**Preconditions:** Signed in with this account.

- [ ] `9B5A` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - A row's **Record** reads 'Go-live support of P-2001 Crane Control', and its **Type** reads **Activity**.
    - Another row's **Record** reads 'Operator training of P-2001 Crane Control'.
  - **Notes:**

- [ ] `C2CF` Tick the rows of 'Go-live support' and 'Operator training'.
  - **Expected:** **Approve 2 drafts…** shows at the right of the page's heading.
  - **Notes:**

- [ ] `82A9` Select **Approve 2 drafts…**.
  - **Expected:** A dialog titled "Approve 2 drafts?" opens.
  - **Notes:**

- [ ] `0611` Select **Approve** in the dialog.
  - **Expected:** A notification says "Approved 2 drafts."
  - **Notes:**

- [ ] `6212` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** tab is chosen.
  - **Notes:**

- [ ] `0F5F` Open the ⋯ menu of 'Crane Control' and select **Show details**.
  - **Expected:**
    - The **Activities** section lists 'Data migration', 'General' and 'Go-live support', with no dots.
    - 'Operator training' is not listed.
  - **Notes:**
