---
title: "Manual Test: Managers and Teams on People"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Managers and Teams on People

## Scope

Verifies the People table's **Manager**, **Manager?**, **Manager assigned**, **Team** and **Team name** columns: who can be picked as a manager, checking and clearing **Manager?** as drafts, the rule that refuses clearing it, team names, the red **Left** box on a manager who has left, filtering and sorting by **Manager?**, and what a Resource Planner sees.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Engineering Director:** `engineering.director@fathom.test`
- **Resource Planner:** `resource.planner@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Appearance menu, marks, the Publish button and searching for a person. This test adds:

- **Manager picker:** the list of people that opens when Enter is pressed in a **Manager** cell.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### MGR-01: Manager? Shows Who Is Marked as a Manager

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Read the column headers from left to right.
  - **Expected:** After **Manager**, in order:
    - **Manager?**
    - **Manager assigned**
    - **Team**
    - **Team name**
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**.
  - **Expected:**
    - The **Manager?** cell shows a checked box.
    - The **Team name** cell reads **Mobile team**.
  - **Notes:**

### MGR-02: The Manager Picker Offers Only People Marked as Managers and Still Employed

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-01.

**Preconditions:** As MGR-01.

- [ ] **Step 1.** Search for **Samuel Richter**.
  - **Expected:** The **Samuel Richter** row is shown.
  - **Notes:**

- [ ] **Step 2.** Select the row's **Manager** cell and press Enter.
  - **Expected:**
    - The Manager picker opens.
    - **Atmananda Ganaka** is chosen.
  - **Notes:**

- [ ] **Step 3.** Type **Max**.
  - **Expected:** **Max Munk** is offered.
  - **Notes:**

- [ ] **Step 4.** Clear the text typed, and type **Lilian**.
  - **Expected:** **Lilian Lang** is not offered.
  - **Notes:**

- [ ] **Step 5.** Press Esc.
  - **Expected:**
    - The picker closes.
    - The row's **Manager** cell still reads **Atmananda Ganaka**.
  - **Notes:**

### MGR-03: One Click Ticks Manager? as a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-02.

**Preconditions:** As MGR-01.

- [ ] **Step 1.** Search for **Lilian Lang**.
  - **Expected:** The **Lilian Lang** row is shown.
  - **Notes:**

- [ ] **Step 2.** Click once in the row's **Manager?** cell.
  - **Expected:**
    - The box is checked.
    - A hollow yellow dot is before it.
    - The cell turns yellow.
  - **Notes:**

- [ ] **Step 3.** Select the Publish button.
  - **Expected:**
    - A notice reads **Published 4 changes.**
    - The Publish button is gone from the top bar.
  - **Notes:**

### MGR-04: An Approved Check Makes Someone a Manager Who Can Be Picked

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from MGR-03. Step 5 signs in as another account.

**Preconditions:** MGR-03 done. Signed in with this account. **Drafts** page open from the left-hand menu.

- [ ] **Step 1.** Type **Lilian Lang** in the search box.
  - **Expected:** One entry is shown: **Engineering Operations Manager drafted changes to Lilian Lang: Manager? from No to Yes**.
  - **Notes:**

- [ ] **Step 2.** Select the entry's checkbox.
  - **Expected:** The entry's checkbox is ticked.
  - **Notes:**

- [ ] **Step 3.** Select **Approve 1 draft**.
  - **Expected:**
    - A dialog headed **Approve 1 draft?** opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] **Step 4.** In the dialog, select **Approve**.
  - **Expected:**
    - The dialog closes.
    - A notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 5.** Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Operations Manager**.
  - **Notes:**

- [ ] **Step 6.** Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] **Step 7.** Search for **Samuel Richter**.
  - **Expected:** The **Samuel Richter** row is shown.
  - **Notes:**

- [ ] **Step 8.** Select the row's **Manager** cell and press Enter.
  - **Expected:** The Manager picker opens.
  - **Notes:**

- [ ] **Step 9.** Type **Lilian**.
  - **Expected:** **Lilian Lang** is offered.
  - **Notes:**

- [ ] **Step 10.** Press Esc.
  - **Expected:**
    - The picker closes.
    - The row's **Manager** cell still reads **Atmananda Ganaka**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### MGR-05: Manager? Cannot Be Cleared While People Report to Someone

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as the account MGR-04 ended with.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Search for **Max Munk**.
  - **Expected:**
    - The **Max Munk** row is shown.
    - Its **Manager?** box is checked.
  - **Notes:**

- [ ] **Step 2.** Click once in the row's **Manager?** cell.
  - **Expected:**
    - A message reads **Reassign direct reports first**.
    - The box stays checked.
    - The row has no dot.
  - **Notes:**

### MGR-06: Changing a Manager Moves the Person to Their New Manager's Team

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-05.

**Preconditions:** As MGR-05.

- [ ] **Step 1.** Search for **Samuel Richter**.
  - **Expected:**
    - The **Manager** cell reads **Atmananda Ganaka**.
    - The **Team** cell reads **Payments team**.
  - **Notes:**

- [ ] **Step 2.** Select the row's **Manager** cell and press Enter.
  - **Expected:** The Manager picker opens.
  - **Notes:**

- [ ] **Step 3.** Type **Max**, and choose **Max Munk**.
  - **Expected:**
    - The **Manager** cell reads **Max Munk**.
    - The **Manager** cell is yellow.
    - A hollow yellow dot is before **Max Munk**.
    - The **Team** cell reads **Mobile team**.
    - The **Team** cell is yellow.
    - The **Manager assigned** cell holds today's date.
  - **Notes:**

- [ ] **Step 4.** Select the **⋯** button at the end of the row, then **Discard draft**.
  - **Expected:**
    - The **Manager** cell reads **Atmananda Ganaka** again.
    - The **Team** cell reads **Payments team**.
  - **Notes:**

### MGR-07: A Team Name Is Edited on Its Manager's Row

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-06.

**Preconditions:** As MGR-05.

- [ ] **Step 1.** Search for **Lorenza Thiel**.
  - **Expected:**
    - The **Lorenza Thiel** row is shown.
    - Its **Team name** cell is empty.
  - **Notes:**

- [ ] **Step 2.** Select the row's **Team name** cell, type **Fictional Crew**, and press Enter.
  - **Expected:**
    - The **Team name** cell reads **Fictional Crew**.
    - The **Team name** cell is yellow.
    - A hollow yellow dot is before **Fictional Crew**.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button at the end of the row, then **Discard draft**.
  - **Expected:**
    - The **Team name** cell is empty.
    - The row has no dot.
  - **Notes:**

### MGR-08: A Manager Who Has Left Is Marked

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-07.

**Preconditions:** As MGR-05.

- [ ] **Step 1.** Search for **西尾 亮**.
  - **Expected:** In **西尾 亮**'s row, the **Manager** cell reads **Viktoria Holmberg**, followed by a red **Left** box.
  - **Notes:**

### MGR-09: People Are Filtered and Sorted by Manager?

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-08.

**Preconditions:** As MGR-05.

- [ ] **Step 1.** Clear the search box.
  - **Expected:** The search box is empty.
  - **Notes:**

- [ ] **Step 2.** Open the **Manager?** column menu, and select **Filter…**.
  - **Expected:** **Yes** is among the choices.
  - **Notes:**

- [ ] **Step 3.** Pick only **Yes**.
  - **Expected:** **Yes** is the only choice picked.
  - **Notes:**

- [ ] **Step 4.** Press Esc.
  - **Expected:**
    - Every row shown has a checked **Manager?** box.
    - **Max Munk** and **Viktoria Holmberg** are among them.
  - **Notes:**

- [ ] **Step 5.** Open the **Manager?** column menu, and select **Filter…**.
  - **Expected:** **Yes** is picked.
  - **Notes:**

- [ ] **Step 6.** Clear **Yes**.
  - **Expected:** **Yes** is no longer picked.
  - **Notes:**

- [ ] **Step 7.** Press Esc.
  - **Expected:** The choices close.
  - **Notes:**

- [ ] **Step 8.** Open the **Manager?** column menu.
  - **Expected:** The menu offers **Checked first** and **Unchecked first**.
  - **Notes:**

- [ ] **Step 9.** Select **Checked first**.
  - **Expected:** The rows with a checked **Manager?** box come first.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### MGR-10: A Resource Planner Sees Managers and Teams but Cannot Change Them

**Account:** Resource Planner, `resource.planner@fathom.test`, changed from MGR-09.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Read the column headers from left to right.
  - **Expected:**
    - **Manager**, **Manager?**, **Team** and **Team name** are shown.
    - **Manager assigned**, **Start** and **End** are not.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**.
  - **Expected:**
    - The **Max Munk** row is shown.
    - Its **Manager?** box is checked.
  - **Notes:**

- [ ] **Step 3.** Click once in the row's **Manager?** cell.
  - **Expected:**
    - The box stays checked.
    - The row has no dot.
  - **Notes:**

- [ ] **Step 4.** Search for **西尾 亮**.
  - **Expected:**
    - In **西尾 亮**'s row, the **Manager** cell reads **Viktoria Holmberg**.
    - The cell has no **Left** box.
  - **Notes:**
