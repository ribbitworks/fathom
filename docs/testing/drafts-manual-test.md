---
title: "Manual Test: Drafts of People, Lists and Columns"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-27"
---

# Manual Test: Drafts of People, Lists and Columns

## Scope

Verifies drafts on the People and Lists pages:

- How drafts of people, columns, lists, choices, and choice orders are shown.
- What a Workforce Administrator, an Engineering Director and a Project Manager can do with them, there and from the top bar, including drafts that use drafts of another kind.
- That nobody approves drafts they changed unless their role grants it, as [Roles](../product/roles.md#what-each-role-can-do) sets out, shown here with a feature's draft.

The Drafts page has [Drafts Page](drafts-page-manual-test.md), and publishing or discarding every change from the top bar has [Unpublished Changes](unpublished-changes-manual-test.md).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Engineering Director:** `engineering.director@fathom.test`
- **Project Manager:** `project.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms this test uses.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### DRAFT-01: Column Drafts Are Marked in the People Table

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `23A9` Look at the **Grade** column header.
  - **Expected:**
    - A yellow dot before **Grade**
    - Under it, a green dot before **Level**
    - The column tinted faint yellow
  - **Notes:**

- [ ] `F31B` Look at the **Role on team** column header.
  - **Expected:** A yellow dot, then **Role on team** struck through.
  - **Notes:**

- [ ] `3D34` Look at the last two column headers.
  - **Expected:**
    - A red dot in a ring before **Previous site**
    - A yellow dot before **Skills**
  - **Notes:**

### DRAFT-02: A Workforce Administrator Can Discard Column Drafts but Not Approve Them

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-01.

**Preconditions:** As DRAFT-01.

- [ ] `5E7E` Select the **Grade** column name to open its column menu.
  - **Expected:** The menu shows, from the top:
    - **Grade**
    - **Copy link**
    - A divider
    - A yellow dot and **Draft**
    - "Name from Level to Grade, by Engineering Operations Manager"
    - "Required from No to Yes, by Second Engineering Operations Manager"
  - **Notes:**

- [ ] `4D46` Look at the actions in the menu.
  - **Expected:**
    - **Discard draft** is among them.
    - **Approve…** and **Reject…** are not.
  - **Notes:**

- [ ] `FB5D` Press Esc.
  - **Expected:** The column menu closes.
  - **Notes:**

### DRAFT-04: Live Only Shows the People Table as It Is Now

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-02.

**Preconditions:** As DRAFT-01.

- [ ] `F453` Open the Draft menu, and select **Live only**.
  - **Expected:** The columns are, from the left:
    - **Name**
    - **ID**
    - **Position**
    - **Site**
    - **Level**
    - **Role on team**
    - **Onboarding**
    - **Work pattern**
    - **Compensation band**
    - **Performance rating**
    - **State**
    - **Start**
    - **Expected**
    - **End**
    - **Manager**
    - **Manager?**
    - **Manager assigned**
    - **Team**
    - **Feature teams**
    - **Team name**
  - **Notes:**

- [ ] `054F` Look at the filter section of the Draft menu, which stays open.
  - **Expected:**
    - The filter section is headed **Filter (needs drafts shown)**.
    - Its choices are greyed out.
  - **Notes:**

- [ ] `332F` Select **Drafts & Live**.
  - **Expected:** **Grade**, **Previous site** and **Skills** are among the columns again.
  - **Notes:**

### DRAFT-26: A Row With a Draft Ends With One Menu Button

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-04.

**Preconditions:** As DRAFT-01.

- [ ] `17CA` Search for `Simone Jean`.
  - **Expected:**
    - Her row is tinted faint yellow.
    - A yellow dot before her **Manager**.
    - A light green Live row is under it.
  - **Notes:**

- [ ] `CDD2` Scroll the table all the way to the right, and read the end of that row.
  - **Expected:**
    - The row ends with one **⋯** button.
    - Nothing is beside it.
  - **Notes:**

### DRAFT-22: Drafts That Others Use Cannot Be Discarded

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-26.

**Preconditions:** **Lists** page open from the left-hand menu.

- [ ] `2F53` Select the details button of 'Skills'.
  - **Expected:**
    - A panel opens.
    - 'Rust' has a yellow dot in its slot.
    - 'TypeScript' has a yellow dot in its slot.
  - **Notes:**

- [ ] `CAE8` Select the **⋯** button at the end of the row of 'Rust', then **Discard draft**.
  - **Expected:**
    - A red notice reads "This choice can't be discarded while other drafts depend on it. Discard those drafts, or change them so they no longer use it, then try again."
    - 'Rust' still has a yellow dot in its slot.
  - **Notes:**

### DRAFT-05: A Rejected Column Draft Offers Nothing to Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from DRAFT-22.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] `67D6` Select the **Previous site** column name to open its column menu.
  - **Expected:**
    - A red dot in a ring, then **Rejected, added**
    - Under them, **Reason:** 'Fictional reason: a previous site is not needed yet.'
    - No **Approve…** and no **Reject…**
  - **Notes:**

### DRAFT-07: A Rejected Person's Draft Offers Nothing to Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-05.

**Preconditions:** As DRAFT-05.

- [ ] `C680` Open the Draft menu, and under **Filter** select **Rejected**.
  - **Expected:**
    - Two people are shown.
    - '우아현' (Employee ID 'E10004'), with a red dot in a ring before her **Position**
    - A light green Live row under the row of '우아현'
    - 'Ophélie Roussel' (Employee ID 'E10152'), with a red dot in a ring in her row's slot
  - **Notes:**

- [ ] `9C68` Press Esc.
  - **Expected:** The Draft menu closes.
  - **Notes:**

### DRAFT-08: The Lists Page Shows Which Lists Have Drafts

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-07.

**Preconditions:** Signed in with this account. **Lists** page open from the left-hand menu.

- [ ] `D033` Read each list's row.
  - **Expected:**
    - 'Certifications' struck through
    - 'Languages', then a yellow **Retired** box
    - A yellow dot in each of the rows of 'Levels', 'Positions', 'Roles on teams', 'Sites' and 'Skills'
    - No dot in the row of 'Hiring states'
  - **Notes:**

- [ ] `E91A` Look at the row under each list.
  - **Expected:** Each list except 'Certifications' and 'Skills' has a light green Live row under it.
  - **Notes:**

### DRAFT-10: Rejected List Drafts Offer Nothing to Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-08.

**Preconditions:** As DRAFT-08.

- [ ] `4C9E` Select the details button of 'Positions'.
  - **Expected:**
    - A panel opens with 'Positions' at the top.
    - A red dot in a ring is before the description under it.
    - One choice has a red dot in a ring before it.
    - That choice has no box.
    - 'Architect': a yellow dot, then its name struck through.
  - **Notes:**

- [ ] `28E8` Close the panel.
  - **Expected:** The panel closes.
  - **Notes:**

### DRAFT-21: A Resubmitted Choice Is Approved With the New Order That Depends on It

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-10. Step `71C1` signs in as another account.

**Preconditions:** Signed in with this account.

- [ ] `04CF` Select the **Lists** page in the left-hand menu.
  - **Expected:** The table of lists shows.
  - **Notes:**

- [ ] `DD9A` Select the details button of 'Sites'.
  - **Expected:** A panel opens with 'Sites' at the top.
  - **Notes:**

- [ ] `1FAD` Select the **⋯** button at the end of the row of 'Harbourside', then **Resubmit**.
  - **Expected:** 'Harbourside' has a yellow dot in its slot.
  - **Notes:**

- [ ] `71C1` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `1A24` Select the **Lists** page in the left-hand menu.
  - **Expected:** The table of lists shows.
  - **Notes:**

- [ ] `EE37` Select the details button of 'Sites'.
  - **Expected:** A panel opens with 'Sites' at the top.
  - **Notes:**

- [ ] `2D66` Select the **⋯** button beside 'Sites' at the top of the panel, then **Approve…**.
  - **Expected:**
    - A dialog titled "Approve 2 drafts?" opens.
    - Under "Also approves the drafts these depend on:" it lists "the choice Harbourside in Sites".
  - **Notes:**

- [ ] `52C7` Select **Approve**.
  - **Expected:**
    - 'Harbourside' is the first choice.
    - 'Harbourside' has no dot and no box.
  - **Notes:**

### DRAFT-25: Drafts This Account Changed Need Another Approver

**Account:** Project Manager, `project.manager@fathom.test`, changed from DRAFT-21. Step `B553` signs in as another account.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

- [ ] `5C1A` In the row 'Scheduler API', select the **Name** cell, replace its text with `Scheduler Service`, then press Enter.
  - **Expected:**
    - The cell reads `Scheduler Service`, with a hollow yellow dot before it.
    - The top bar shows **Publish 1 change**.
  - **Notes:**

- [ ] `6E2B` Select **Publish 1 change** in the top bar.
  - **Expected:** The top bar no longer offers to publish.
  - **Notes:**

- [ ] `8A3F` Select the **⋯** button at the end of the row of `Scheduler Service`.
  - **Expected:**
    - **Approve draft…** is greyed out.
    - "Needs another approver" is under it, easy to read.
    - **Reject draft…** is not greyed out.
  - **Notes:**

- [ ] `3CBD` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `7DEE` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - A row's **Record** reads `Scheduler Service`.
    - After it, a grey box reads "Needs another approver".
    - Its **Made by** reads "Project Manager".
  - **Notes:**

- [ ] `B553` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `9FAB` Select the **Drafts** page in the left-hand menu.
  - **Expected:** A row's **Record** reads `Scheduler Service`, with no box after it.
  - **Notes:**

**Afterwards:** Run Reset the Database.
