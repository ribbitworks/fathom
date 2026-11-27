---
title: "Manual Test: Managers and Teams on People"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/people.md"]
last_updated: "2026-11-27"
---

# Manual Test: Managers and Teams on People

## Scope

Verifies the People table's **Manager**, **Manager?**, **Manager assigned**, **Team** and **Team name** columns:

- Who can be picked as a manager, and how each is described in the picker.
- Checking and clearing **Manager?** as drafts, and the rule that refuses clearing it.
- Team names and their colours.
- The red **Left** box on a manager who has left.
- How the rows read grouped by manager.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Engineering Director:** `engineering.director@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Publish button and searching for a person. This test adds:

- **Manager picker:** the list of people that opens when Enter is pressed in a **Manager** cell.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### MGR-01: Manager? Shows Who Is Marked as a Manager

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `C677` Read the column headers from left to right.
  - **Expected:** After **Manager**, in order:
    - **Manager?**
    - **Manager assigned**
    - **Team**
    - **Feature teams**
    - **Team name**
  - **Notes:**

- [ ] `693C` Search for `Max Munk`.
  - **Expected:**
    - The **Manager?** cell shows a checked box.
    - The **Team name** cell reads 'Mobile team', after a small orange square.
  - **Notes:**

### MGR-02: The Manager Picker Offers Only People Marked as Managers and Still Employed

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-01.

**Preconditions:** As MGR-01.

- [ ] `B750` Search for `Samuel Richter`.
  - **Expected:** The 'Samuel Richter' row is shown.
  - **Notes:**

- [ ] `1B52` Select the row's **Manager** cell and press Enter.
  - **Expected:**
    - The Manager picker opens.
    - 'Atmananda Ganaka' is chosen.
  - **Notes:**

- [ ] `D766` Type `Max`.
  - **Expected:**
    - 'Max Munk' is offered.
    - Under 'Max Munk', in smaller, dimmed text: "Engineering Manager, reports to Mateo Quintero Reynoso".
  - **Notes:**

- [ ] `69C3` Clear the text typed, and type `Lilian`.
  - **Expected:** 'Lilian Lang' is not offered.
  - **Notes:**

- [ ] `FC50` Press Esc.
  - **Expected:**
    - The picker closes.
    - The row's **Manager** cell still reads 'Atmananda Ganaka'.
  - **Notes:**

### MGR-03: One Click Ticks Manager? as a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-02.

**Preconditions:** As MGR-01.

- [ ] `E308` Search for `Lilian Lang`.
  - **Expected:** The 'Lilian Lang' row is shown.
  - **Notes:**

- [ ] `9A02` Click once in the row's **Manager?** cell.
  - **Expected:**
    - The box is checked.
    - A hollow yellow dot is before it.
    - The cell turns yellow.
  - **Notes:**

- [ ] `8A51` Select the Publish button.
  - **Expected:**
    - A notification starts "Published" and the number of changes.
    - The Publish button is gone from the top bar.
  - **Notes:**

### MGR-04: An Approved Check Makes Someone a Manager Who Can Be Picked

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from MGR-03. Step `9D0D` signs in as another account.

**Preconditions:** MGR-03 done. Signed in with this account. **Drafts** page open from the left-hand menu, with **To decide** chosen beside the page's title.

- [ ] `DFCC` Type `Lilian Lang` in the search box.
  - **Expected:** One row is shown:
    - **Record** reads 'Lilian Lang'.
    - **Change** reads "Changed".
    - **What changes** reads "Manager? from No to Yes".
    - **Made by** reads "Engineering Operations Manager as Workforce Administrator".
  - **Notes:**

- [ ] `C48D` Tick that row's tick box.
  - **Expected:**
    - The row's tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `EA2A` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:**
    - A dialog headed "Approve 1 draft?" opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `C4DA` In the dialog, select **Approve**.
  - **Expected:**
    - The dialog closes.
    - A notification says "Approved 1 draft."
  - **Notes:**

- [ ] `9D0D` Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Operations Manager".
  - **Notes:**

- [ ] `4F3C` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `CCA6` Search for `Samuel Richter`.
  - **Expected:** The 'Samuel Richter' row is shown.
  - **Notes:**

- [ ] `B7D4` Select the row's **Manager** cell and press Enter.
  - **Expected:** The Manager picker opens.
  - **Notes:**

- [ ] `B754` Type `Lilian`.
  - **Expected:** 'Lilian Lang' is offered.
  - **Notes:**

- [ ] `EE56` Press Esc.
  - **Expected:**
    - The picker closes.
    - The row's **Manager** cell still reads 'Atmananda Ganaka'.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### MGR-05: Manager? Cannot Be Cleared While People Report to Someone

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account MGR-04 ended with.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `588F` Search for `Max Munk`.
  - **Expected:**
    - The 'Max Munk' row is shown.
    - Its **Manager?** box is checked.
  - **Notes:**

- [ ] `61BE` Click once in the row's **Manager?** cell.
  - **Expected:**
    - A message reads "Reassign direct reports first".
    - The box stays checked.
    - The row has no dot.
  - **Notes:**

### MGR-06: Changing a Manager Moves the Person to Their New Manager's Team

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-05.

**Preconditions:** As MGR-05.

- [ ] `2CB4` Search for `Samuel Richter`.
  - **Expected:**
    - The **Manager** cell reads 'Atmananda Ganaka'.
    - The **Team** cell reads 'Payments team'.
  - **Notes:**

- [ ] `7A36` Select the row's **Manager** cell and press Enter.
  - **Expected:** The Manager picker opens.
  - **Notes:**

- [ ] `E6C7` Type `Max`, and choose 'Max Munk'.
  - **Expected:**
    - The **Manager** cell reads 'Max Munk'.
    - The **Manager** cell is yellow.
    - A hollow yellow dot is before 'Max Munk'.
    - The **Team** cell reads 'Mobile team'.
    - The **Team** cell is yellow.
    - The **Manager assigned** cell holds today's date.
  - **Notes:**

- [ ] `15AF` Select the **⋯** button at the end of the row, then **Discard draft**.
  - **Expected:**
    - The **Manager** cell reads 'Atmananda Ganaka' again.
    - The **Team** cell reads 'Payments team'.
  - **Notes:**

### MGR-07: A Team Name Is Edited on Its Manager's Row

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-06.

**Preconditions:** As MGR-05.

- [ ] `2FD7` Search for `Lorenza Thiel`.
  - **Expected:**
    - The 'Lorenza Thiel' row is shown.
    - Its **Team name** cell is empty, with no colour square.
  - **Notes:**

- [ ] `F4A6` Select the row's **Team name** cell, type `Fictional Crew`, and press Enter.
  - **Expected:**
    - The **Team name** cell reads `Fictional Crew`.
    - The **Team name** cell is yellow.
    - A hollow yellow dot is before `Fictional Crew`.
  - **Notes:**

- [ ] `B0E1` Select the **⋯** button at the end of the row, then **Discard draft**.
  - **Expected:**
    - The **Team name** cell is empty.
    - The row has no dot.
  - **Notes:**

### MGR-08: A Manager Who Has Left Is Marked

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-07.

**Preconditions:** As MGR-05.

- [ ] `DED2` Search for `西尾 亮`.
  - **Expected:** In the row of '西尾 亮', the **Manager** cell reads 'Viktoria Holmberg', followed by a red **Left** box.
  - **Notes:**

### MGR-09: People Are Filtered and Sorted by Manager?

Proved by automated tests in `apps/web/src/table-rows.test.ts` and `apps/web/src/people-grid-managers.test.tsx`.

### MGR-10: A Feature Lead Sees Managers and Teams but Cannot Change Them

Proved by automated tests in `apps/web/src/people-grid-managers.test.tsx` and `apps/server/src/changes.test.ts`.

### MGR-11: People Are Grouped by Manager

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-08.

**Preconditions:** **People** page open from the left-hand menu, with the search box cleared.

- [ ] `9652` Read the button after **Metrics** above the table.
  - **Expected:**
    - It reads **Group by**, naming no grouping.
    - The rows show as one list, with no headings.
  - **Notes:**

- [ ] `6B5A` Select **Group by**, then **Manager**.
  - **Expected:**
    - The button reads **Group by: Manager**.
    - Each heading names a manager, followed by a comma and their team's name where the team has one, such as **Max Munk, Mobile team**.
    - A manager whose team has no name is named alone.
    - Each heading has how many people it holds.
    - The headings run in order of the managers' names.
    - The last heading is **No manager**.
  - **Notes:**

- [ ] `D80E` Type `Max Munk` in the search box above the table.
  - **Expected:**
    - One heading shows, naming the manager the 'Max Munk' row's **Manager** cell names.
    - The 'Max Munk' row is under it.
  - **Notes:**

- [ ] `E9C9` Clear the search box.
  - **Expected:** Every person shows again, under their manager's heading.
  - **Notes:**

- [ ] `D69D` Select **Group by: Manager**, then **None** under **Group by**.
  - **Expected:** The headings are gone, and the rows show as one list.
  - **Notes:**
