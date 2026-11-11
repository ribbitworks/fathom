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

Verifies the People table's **Manager**, **Manager?**, **Manager assigned**, **Team** and **Team name** columns: who can be picked as a manager, checking and clearing **Manager?** as drafts, the rule that refuses clearing it, team names, the mark on a manager who has left, filtering and sorting by **Manager?**, and what a Resource Planner sees.

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

- **Manager picker:** the list of people that opens when you select a **Manager** cell and press Enter.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Check each step whose expected result you see, and write anything else under its notes.

### MGR-01: Manager? Shows Who Is Marked as a Manager

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Read the column headers from left to right.
  - **Expected:** **Manager?** comes straight after **Manager**, followed by **Manager assigned**, **Team** and **Team name**.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**.
  - **Expected:** The **Manager?** cell shows a checked box. The **Team name** cell reads **Mobile team**.
  - **Notes:**

### MGR-02: The Manager Picker Offers Only People Marked as Managers and Still Employed

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-01.

**Preconditions:** As MGR-01.

- [ ] **Step 1.** Search for **Samuel Richter**. Select the row's **Manager** cell and press Enter.
  - **Expected:** The Manager picker opens, with **Atmananda Ganaka** chosen.
  - **Notes:**

- [ ] **Step 2.** Type **Max**.
  - **Expected:** **Max Munk** is offered.
  - **Notes:**

- [ ] **Step 3.** Clear what you typed, and type **Lilian**.
  - **Expected:** **Lilian Lang** is not offered.
  - **Notes:**

- [ ] **Step 4.** Press Esc.
  - **Expected:** The picker closes, and the row's **Manager** cell still reads **Atmananda Ganaka**.
  - **Notes:**

### MGR-03: One Click Ticks Manager? as a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-02.

**Preconditions:** As MGR-01.

- [ ] **Step 1.** Search for **Lilian Lang**. Click once in the row's **Manager?** cell.
  - **Expected:** The box is checked and the cell turns yellow. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Select the Publish button.
  - **Expected:** A notice reads **Published 4 changes.** The Publish button is gone from the top bar.
  - **Notes:**

### MGR-04: An Approved Check Makes Someone a Manager Who Can Be Picked

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from MGR-03. Step 3 signs in as another account.

**Preconditions:** MGR-03 done. Signed in with this account. **Drafts** page open from the left-hand menu.

- [ ] **Step 1.** Type **Lilian Lang** in the search box.
  - **Expected:** One entry is shown: **Engineering Operations Manager drafted changes to Lilian Lang: Manager? from No to Yes**.
  - **Notes:**

- [ ] **Step 2.** Select the entry's checkbox, then **Approve**. In the dialog, select **Approve**.
  - **Expected:** The dialog closes, and a notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 3.** Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`. Open **People**, search for **Samuel Richter**, select the row's **Manager** cell, press Enter, and type **Lilian**.
  - **Expected:** **Lilian Lang** is offered.
  - **Notes:**

- [ ] **Step 4.** Press Esc.
  - **Expected:** The picker closes, and the row's **Manager** cell still reads **Atmananda Ganaka**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### MGR-05: Manager? Cannot Be Cleared While People Report to Someone

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as the account MGR-04 ended with.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Search for **Max Munk**. Click once in the row's **Manager?** cell.
  - **Expected:** A message reads **Reassign direct reports first**. The box stays checked, and the row has no **Draft** mark.
  - **Notes:**

### MGR-06: Changing a Manager Moves the Person to Their New Manager's Team

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-05.

**Preconditions:** As MGR-05.

- [ ] **Step 1.** Search for **Samuel Richter**, whose **Manager** cell reads **Atmananda Ganaka** and **Team** cell **Payments team**. Select the row's **Manager** cell, press Enter, type **Max**, and choose **Max Munk**.
  - **Expected:** The **Manager** cell reads **Max Munk** and the row's **Team** cell reads **Mobile team**, both yellow. The **Manager assigned** cell holds today's date. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button at the end of the row, then **Discard draft**.
  - **Expected:** The **Manager** cell reads **Atmananda Ganaka** again, and the **Team** cell **Payments team**.
  - **Notes:**

### MGR-07: A Team Name Is Edited on Its Manager's Row

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-06.

**Preconditions:** As MGR-05.

- [ ] **Step 1.** Search for **Lorenza Thiel**. Select the row's **Team name** cell, type **Fictional Crew**, and press Enter.
  - **Expected:** The **Team name** cell reads **Fictional Crew**, in yellow. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button at the end of the row, then **Discard draft**.
  - **Expected:** The **Team name** cell is empty, and the row has no **Draft** mark.
  - **Notes:**

### MGR-08: A Manager Who Has Left Is Marked

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-07.

**Preconditions:** As MGR-05.

- [ ] **Step 1.** Search for **西尾 亮**.
  - **Expected:** In **西尾 亮**'s row, the **Manager** cell reads **Viktoria Holmberg**, followed by a red dot and **Left**.
  - **Notes:**

### MGR-09: People Are Filtered and Sorted by Manager?

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as MGR-08.

**Preconditions:** As MGR-05.

- [ ] **Step 1.** Clear the search box. Open the **Manager?** column menu, select **Filter…**, and pick only **Yes**. Press Esc.
  - **Expected:** Every row shown has a checked **Manager?** box, among them **Max Munk** and **Viktoria Holmberg**.
  - **Notes:**

- [ ] **Step 2.** Open the **Manager?** column menu, select **Filter…**, and clear **Yes**. Press Esc. Open the **Manager?** column menu again.
  - **Expected:** The menu offers **Checked first** and **Unchecked first**.
  - **Notes:**

- [ ] **Step 3.** Select **Checked first**.
  - **Expected:** The rows with a checked **Manager?** box come first.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### MGR-10: A Resource Planner Sees Managers and Teams but Cannot Change Them

**Account:** Resource Planner, `resource.planner@fathom.test`, changed from MGR-09.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Read the column headers from left to right.
  - **Expected:** **Manager**, **Manager?**, **Team** and **Team name** are shown. **Manager assigned**, **Start** and **End** are not.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**. Click once in the row's **Manager?** cell.
  - **Expected:** The box stays checked, and the row has no **Draft** mark.
  - **Notes:**

- [ ] **Step 3.** Search for **西尾 亮**.
  - **Expected:** In **西尾 亮**'s row, the **Manager** cell reads **Viktoria Holmberg**, with no **Left** mark.
  - **Notes:**
