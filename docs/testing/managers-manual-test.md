---
title: "Manual Test: Managers and Teams on People"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-04"
---

# Manual Test: Managers and Teams on People

## Scope

Verifies the People table's **Manager**, **Manager?**, **Manager since**, **Team** and **Team name** columns: who can be picked as a manager, checking and clearing **Manager?** as drafts, the rules that refuse clearing it, team names, the mark on a manager who has left, filtering and metrics by **Manager?**, metrics by **Manager**, and what a Resource Planner sees.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It can change people, and its changes are drafts; it cannot approve them.
- **Approver account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. It can approve and reject drafts; it cannot change people.
- **Resource Planner account:** `resource.planner@fathom.test`, shown in Fathom as **Resource Planner**. It sees people without their Restricted details, such as their dates, and cannot change them.

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

- [ ] **Step 3.** Search for **Lilian Lang**.
  - **Expected:** The **Manager?** cell shows an empty box. The **Manager** cell reads **Van Wiza**.
  - **Notes:**

- [ ] **Step 4.** Search for **Viktoria Holmberg**.
  - **Expected:** The row has a yellow dot and **Draft**, with a light green **Live** row under it. Both rows show a checked box in the **Manager?** cell. The **End** cell of the **Live** row holds a date in the past.
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

- [ ] **Step 4.** Clear what you typed, and type **Viktoria**.
  - **Expected:** **Viktoria Holmberg** is not offered.
  - **Notes:**

- [ ] **Step 5.** Press Esc.
  - **Expected:** The picker closes, and the row's **Manager** cell still reads **Atmananda Ganaka**.
  - **Notes:**

### MGR-03: One Click Ticks Manager? as a Draft

**Preconditions:** As MGR-01.

- [ ] **Step 1.** Search for **Lilian Lang**. Click once in the row's **Manager?** cell.
  - **Expected:** The box is checked and the cell turns yellow. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Look at the Publish button.
  - **Expected:** It reads **Publish 4 changes**.
  - **Notes:**

- [ ] **Step 3.** Search for **Samuel Richter**. Select the row's **Manager** cell, press Enter, and type **Lilian**.
  - **Expected:** **Lilian Lang** is not offered.
  - **Notes:**

- [ ] **Step 4.** Press Esc. Select the Publish button.
  - **Expected:** A notice reads **Published 4 changes.** The Publish button is gone from the top bar.
  - **Notes:**

### MGR-04: An Approved Check Makes Someone a Manager Who Can Be Picked

**Preconditions:** MGR-03 done. Signed in (P1) as `engineering.director@fathom.test`. **Drafts** page open from the left-hand menu.

- [ ] **Step 1.** Type **Lilian Lang** in the search box.
  - **Expected:** One entry is shown: **Engineering Operations Manager drafted changes to Lilian Lang: Manager? from No to Yes**.
  - **Notes:**

- [ ] **Step 2.** Select the entry's checkbox, then **Approve**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 3.** Select **Approve**.
  - **Expected:** The dialog closes, and a notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 4.** Sign in (P1) as `engineering.operations.manager@fathom.test`. Open **People**, search for **Samuel Richter**, select the row's **Manager** cell, press Enter, and type **Lilian**.
  - **Expected:** **Lilian Lang** is offered.
  - **Notes:**

- [ ] **Step 5.** Press Esc.
  - **Expected:** The picker closes, and the row's **Manager** cell still reads **Atmananda Ganaka**.
  - **Notes:**

### MGR-05: Manager? Can Be Cleared From Someone Nobody Reports To

**Preconditions:** MGR-04 done. Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open.

- [ ] **Step 1.** Search for **Lilian Lang**. Click once in the row's **Manager?** cell.
  - **Expected:** The box is empty and the cell turns yellow. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Select the Publish button.
  - **Expected:** A notice reads **Published 1 change.** The Publish button is gone from the top bar.
  - **Notes:**

- [ ] **Step 3.** Sign in (P1) as `engineering.director@fathom.test`. Open **Drafts**, and type **Lilian Lang** in the search box.
  - **Expected:** One entry is shown: **Engineering Operations Manager drafted changes to Lilian Lang: Manager? from Yes to No**.
  - **Notes:**

- [ ] **Step 4.** Select the entry's checkbox, then **Approve**. In the dialog, select **Approve**.
  - **Expected:** The dialog closes, and a notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 5.** Open **People**, and search for **Lilian Lang**.
  - **Expected:** The **Manager?** cell shows an empty box, and the row has no **Draft** mark.
  - **Notes:**

**Afterwards:** R1.

### MGR-06: Manager? Cannot Be Cleared While People Report to Someone

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open.

- [ ] **Step 1.** Search for **Max Munk**. Click once in the row's **Manager?** cell.
  - **Expected:** A message reads **Manager? stays checked while anyone reports to this person, or is drafted to**. The box stays checked, and the row has no **Draft** mark.
  - **Notes:**

- [ ] **Step 2.** Search for **Silje Holm-Schrøder**. Click once in the row's **Manager?** cell.
  - **Expected:** The same message is shown, and the box stays checked.
  - **Notes:**

### MGR-07: Changing a Manager Moves the Person to Their New Manager's Team

**Preconditions:** As MGR-06.

- [ ] **Step 1.** Search for **Samuel Richter**.
  - **Expected:** The **Manager** cell reads **Atmananda Ganaka** and the row's **Team** cell reads **Payments team**.
  - **Notes:**

- [ ] **Step 2.** Select the row's **Manager** cell, press Enter, type **Max**, and choose **Max Munk**.
  - **Expected:** The **Manager** cell reads **Max Munk** and the row's **Team** cell reads **Mobile team**, both yellow. The **Manager since** cell holds today's date. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button at the end of the row, then **Discard draft**.
  - **Expected:** The **Manager** cell reads **Atmananda Ganaka** again, and the **Team** cell **Payments team**.
  - **Notes:**

### MGR-08: A Team Name Is Edited on Its Manager's Row and Shown for Their Reports

**Preconditions:** As MGR-06.

- [ ] **Step 1.** Search for **Lorenza Thiel**. Select the row's **Team name** cell, type **Fictional Crew**, and press Enter.
  - **Expected:** The **Team name** cell reads **Fictional Crew**, in yellow. The row has a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Search for **Valéry Caron**.
  - **Expected:** The **Manager** cell reads **Lorenza Thiel** and the row's **Team** cell reads **Fictional Crew**.
  - **Notes:**

- [ ] **Step 3.** Search for **Lorenza Thiel**. Select the **⋯** button at the end of the row, then **Discard draft**.
  - **Expected:** The **Team name** cell is empty, and the row has no **Draft** mark.
  - **Notes:**

### MGR-09: A Manager Who Has Left Is Marked

**Preconditions:** As MGR-06.

- [ ] **Step 1.** Search for **西尾 亮**.
  - **Expected:** The **Manager** cell reads **Viktoria Holmberg**, followed by a red dot and **Left**.
  - **Notes:**

- [ ] **Step 2.** Search for **Samuel Richter**. Select the row's **Manager** cell, press Enter, and type **Viktoria**.
  - **Expected:** **Viktoria Holmberg** is not offered.
  - **Notes:**

- [ ] **Step 3.** Press Esc.
  - **Expected:** The picker closes.
  - **Notes:**

### MGR-10: People Are Filtered, Sorted and Counted by Manager?

**Preconditions:** As MGR-06.

- [ ] **Step 1.** Open the **Manager?** column menu, select **Filter…**, and pick only **Yes**. Press Esc.
  - **Expected:** Every row shown has a checked **Manager?** box, among them **Max Munk** and **Viktoria Holmberg**.
  - **Notes:**

- [ ] **Step 2.** Open the **Manager?** column menu, select **Filter…**, clear **Yes**, and pick only **No**. Press Esc.
  - **Expected:** Every row shown has an empty **Manager?** box, among them **Lilian Lang**.
  - **Notes:**

- [ ] **Step 3.** Open the **Manager?** column menu, select **Filter…**, and clear **No**. Press Esc. Open the **Manager?** column menu again.
  - **Expected:** The menu offers **Checked first** and **Unchecked first**.
  - **Notes:**

- [ ] **Step 4.** Select **Checked first**.
  - **Expected:** The rows with a checked **Manager?** box come first.
  - **Notes:**

- [ ] **Step 5.** Open the **Manager?** column menu, and select **Break down by**.
  - **Expected:** The Metrics panel opens with **Break down by** set to **Manager?**, with a row for **Yes** and a row for **No**. The **Yes** row counts 16 people.
  - **Notes:**

- [ ] **Step 6.** Open the **Manager** column menu, and select **Break down by**.
  - **Expected:** The Metrics panel shows **Break down by** set to **Manager**, with a row for each manager and a **No manager** row. The **Max Munk** row counts 9 people.
  - **Notes:**

**Afterwards:** R1.

### MGR-11: A Resource Planner Sees Managers and Teams but Cannot Change Them

**Preconditions:** Signed in (P1) as `resource.planner@fathom.test`. **People** page open.

- [ ] **Step 1.** Read the column headers from left to right.
  - **Expected:** **Manager**, **Manager?**, **Team** and **Team name** are shown. **Manager since**, **Start** and **End** are not.
  - **Notes:**

- [ ] **Step 2.** Search for **Max Munk**. Click once in the row's **Manager?** cell.
  - **Expected:** The box stays checked, and the row has no **Draft** mark.
  - **Notes:**

- [ ] **Step 3.** Search for **西尾 亮**.
  - **Expected:** The **Manager** cell reads **Viktoria Holmberg**, with no **Left** mark.
  - **Notes:**
