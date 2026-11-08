---
title: "Manual Test: Managers and Teams on People"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-07"
---

# Manual Test: Managers and Teams on People

## Scope

Verifies the People table's **Manager**, **Manager?**, **Manager since**, **Team** and **Team name** columns: who can be picked as a manager, checking and clearing **Manager?** as drafts, the rule that refuses clearing it, team names, the mark on a manager who has left, filtering and sorting by **Manager?**, and what a Resource Planner sees.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Engineering Director account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. It holds the Engineering Director role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Resource Planner account:** `resource.planner@fathom.test`, shown in Fathom as **Resource Planner**. It holds the Resource Planner role, as [Roles](../product/roles.md#starting-roles) sets out.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use after R0, before the first test case, and wherever a test case says so. Fathom keeps running. This removes the seed data and every draft of it, including drafts made during the test, then adds the seed data again; it keeps accounts and anything else added by hand.

1. In the second terminal, run:

   ```sh
   pnpm db:unseed && pnpm db:seed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

### P1: Sign In

1. If someone is signed in, sign out first (P2).
2. On the **Sign in** page, enter the account's email address and the shared password.
3. Select **Sign in**.

### P2: Sign Out

1. Select the account button at the top right, which shows the account's name.
2. Select **Sign out**.

## Terms

- **Search for:** type the person's name in the search box above the People table, so only their row is shown.
- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown beside a person's name or under a column's name.
- **Manager picker:** the list of people that opens when you select a **Manager** cell and press Enter.
- **Column menu:** the menu that opens when you select a column's name in the People table's header.
- **Publish button:** the button in the top bar, beside your name, that reads **Publish** followed by a number of changes.
- **⋯ menu:** the menu that opens from the **⋯** button at the end of a row.

## Test Cases

Run the test cases in order. Start with R0, then R1. Check each step whose expected result you see, and write anything else under its notes.

### MGR-01: Manager? Shows Who Is Marked as a Manager

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open from the left-hand menu.

- [ ] **Step 1.** Read the column headers from left to right.
  - **Expected:** **Manager?** comes straight after **Manager**, followed by **Manager since**, **Team** and **Team name**.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**.
  - **Expected:** The **Manager?** cell shows a checked box. The **Team name** cell reads **Mobile team**.
  - **Notes:**

### MGR-02: The Manager Picker Offers Only People Marked as Managers and Still Employed

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

**Preconditions:** As MGR-01.

- [ ] **Step 1.** Search for **Lilian Lang**. Click once in the row's **Manager?** cell.
  - **Expected:** The box is checked and the cell turns yellow. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Select the Publish button.
  - **Expected:** A notice reads **Published 4 changes.** The Publish button is gone from the top bar.
  - **Notes:**

### MGR-04: An Approved Check Makes Someone a Manager Who Can Be Picked

**Preconditions:** MGR-03 done. Signed in (P1) as `engineering.director@fathom.test`. **Drafts** page open from the left-hand menu.

- [ ] **Step 1.** Type **Lilian Lang** in the search box.
  - **Expected:** One entry is shown: **Engineering Operations Manager drafted changes to Lilian Lang: Manager? from No to Yes**.
  - **Notes:**

- [ ] **Step 2.** Select the entry's checkbox, then **Approve**. In the dialog, select **Approve**.
  - **Expected:** The dialog closes, and a notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 3.** Sign in (P1) as `engineering.operations.manager@fathom.test`. Open **People**, search for **Samuel Richter**, select the row's **Manager** cell, press Enter, and type **Lilian**.
  - **Expected:** **Lilian Lang** is offered.
  - **Notes:**

- [ ] **Step 4.** Press Esc.
  - **Expected:** The picker closes, and the row's **Manager** cell still reads **Atmananda Ganaka**.
  - **Notes:**

**Afterwards:** R1.

### MGR-05: Manager? Cannot Be Cleared While People Report to Someone

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open.

- [ ] **Step 1.** Search for **Max Munk**. Click once in the row's **Manager?** cell.
  - **Expected:** A message reads **Reassign direct reports first**. The box stays checked, and the row has no **Draft** mark.
  - **Notes:**

### MGR-06: Changing a Manager Moves the Person to Their New Manager's Team

**Preconditions:** As MGR-05.

- [ ] **Step 1.** Search for **Samuel Richter**, whose **Manager** cell reads **Atmananda Ganaka** and **Team** cell **Payments team**. Select the row's **Manager** cell, press Enter, type **Max**, and choose **Max Munk**.
  - **Expected:** The **Manager** cell reads **Max Munk** and the row's **Team** cell reads **Mobile team**, both yellow. The **Manager since** cell holds today's date. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button at the end of the row, then **Discard draft**.
  - **Expected:** The **Manager** cell reads **Atmananda Ganaka** again, and the **Team** cell **Payments team**.
  - **Notes:**

### MGR-07: A Team Name Is Edited on Its Manager's Row

**Preconditions:** As MGR-05.

- [ ] **Step 1.** Search for **Lorenza Thiel**. Select the row's **Team name** cell, type **Fictional Crew**, and press Enter.
  - **Expected:** The **Team name** cell reads **Fictional Crew**, in yellow. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button at the end of the row, then **Discard draft**.
  - **Expected:** The **Team name** cell is empty, and the row has no **Draft** mark.
  - **Notes:**

### MGR-08: A Manager Who Has Left Is Marked

**Preconditions:** As MGR-05.

- [ ] **Step 1.** Search for **西尾 亮**.
  - **Expected:** In **西尾 亮**'s row, the **Manager** cell reads **Viktoria Holmberg**, followed by a red dot and **Left**.
  - **Notes:**

### MGR-09: People Are Filtered and Sorted by Manager?

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

**Afterwards:** R1.

### MGR-10: A Resource Planner Sees Managers and Teams but Cannot Change Them

**Preconditions:** Signed in (P1) as `resource.planner@fathom.test`. **People** page open.

- [ ] **Step 1.** Read the column headers from left to right.
  - **Expected:** **Manager**, **Manager?**, **Team** and **Team name** are shown. **Manager since**, **Start** and **End** are not.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**. Click once in the row's **Manager?** cell.
  - **Expected:** The box stays checked, and the row has no **Draft** mark.
  - **Notes:**

- [ ] **Step 3.** Search for **西尾 亮**.
  - **Expected:** In **西尾 亮**'s row, the **Manager** cell reads **Viktoria Holmberg**, with no **Left** mark.
  - **Notes:**
