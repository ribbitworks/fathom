---
title: "Manual Test: Feature Assignments"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/feature-assignments-page*", "apps/web/src/team-months*", "apps/web/src/team-labels*", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-09"
---

# Manual Test: Feature Assignments

## Scope

Verifies the **Feature assignments** page: how the table of feature teams by month looks and scrolls in light and dark mode, grouping its rows, searching and filtering it, how it agrees with the **Org chart** on a chosen month, what a reader without Restricted details sees, and moving around it from the keyboard. The seeded feature teams are listed in [Development Setup](../design/development-setup.md#fictional-seed-data).

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser with a mouse or trackpad, and a keyboard.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Resource Planner account:** `resource.planner@fathom.test`, shown in Fathom as **Resource Planner**. It holds the Resource Planner role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Team Member account:** `team.member@fathom.test`, shown in Fathom as **Team Member**. It holds the Team Member role, as [Roles](../product/roles.md#starting-roles) sets out.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use after R0, before the first test case. Fathom keeps running. This removes the seed data and every draft of it, then adds the seed data again; it keeps accounts and anything else added by hand.

1. In the second terminal, run:

   ```sh
   pnpm db:reseed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

## Terms

- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance**, in the menu that opens from the name and initials at the top right of every page.
- **Group by menu:** the button above the table that starts **Group by:** and names the grouping in use.

## Test Cases

### FA-01: The Page Opens at the Current Month

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** R1 has been run. Signed in with this account.

- [ ] **Step 1.** Select **Feature assignments** in the left-hand menu.
  - **Expected:** The page is headed **Feature assignments**. Above the table are a switch reading **Teams** and a greyed-out **Allocations, later**, then a search box, **Metrics**, and **Group by: Manager**. There is no **Draft** button. The table has a **Person** column on the left and a column for each month.
  - **Notes:**

- [ ] **Step 2.** Look at the month headings without scrolling.
  - **Expected:** The current month is the first month beside the **Person** column.
  - **Notes:**

### FA-02: Names and Months Stay in View

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-01.

**Preconditions:** **Feature assignments** open.

- [ ] **Step 1.** Scroll the table sideways.
  - **Expected:** The **Person** column stays on the left, with nothing showing through it.
  - **Notes:**

- [ ] **Step 2.** Scroll the table down.
  - **Expected:** The month headings stay at the top, with nothing showing through them.
  - **Notes:**

### FA-03: Labels Name Each Team in Its Colour

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-02.

**Preconditions:** **Feature assignments** open, with the current month in view.

- [ ] **Step 1.** Find a coloured label in the current month's column and compare its colour with that team on the **Org chart**.
  - **Expected:** Each label names a feature team, in the colour the **Org chart** gives it. A team with no colour, such as **Platform reliability**, has a neutral label.
  - **Notes:**

- [ ] **Step 2.** Hold the pointer over a label.
  - **Expected:** After a moment, a tooltip shows the team's whole name.
  - **Notes:**

### FA-04: The Table Reads Well in Light and Dark Mode

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-03.

**Preconditions:** **Feature assignments** open.

- [ ] **Step 1.** Select **Light** in the Appearance menu.
  - **Expected:** The labels, headings, group names and shaded cells are easy to read.
  - **Notes:**

- [ ] **Step 2.** Select **Dark** in the Appearance menu.
  - **Expected:** The labels, headings, group names and shaded cells are easy to read.
  - **Notes:**

### FA-05: Rows Group by Manager, Feature Team or Not at All

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-04.

**Preconditions:** **Feature assignments** open.

- [ ] **Step 1.** Select **Feature team** in the Group by menu.
  - **Expected:** The rows are grouped under the feature teams in order of name, then **No feature team**. Someone on two teams is listed under both.
  - **Notes:**

- [ ] **Step 2.** Reload the page.
  - **Expected:** **Group by: Feature team** still shows, and the table opens at the current month again.
  - **Notes:**

- [ ] **Step 3.** Select **None** in the Group by menu.
  - **Expected:** There are no group names, and everyone is listed once, by name.
  - **Notes:**

### FA-06: Search Finds Teams in Any Month

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-05.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Type **Search** in the search box.
  - **Expected:** Only people with a **Search** label in some month are listed. The count of rows above the table goes down.
  - **Notes:**

### FA-07: A Month Can Be Filtered by Team

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-06.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Open the column menu of the current month.
  - **Expected:** The menu offers **Filter…**.
  - **Notes:**

- [ ] **Step 2.** Select **Filter…**.
  - **Expected:** A list of the feature teams opens.
  - **Notes:**

- [ ] **Step 3.** Select **Payments core**.
  - **Expected:** Only people on **Payments core** that month are listed.
  - **Notes:**

- [ ] **Step 4.** Press Esc.
  - **Expected:** A filter pill above the table names the month and the team.
  - **Notes:**

### FA-08: People Can Be Filtered by Name

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-07.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Open the **Person** column menu.
  - **Expected:** The menu offers **Filter…**.
  - **Notes:**

- [ ] **Step 2.** Select **Filter…**.
  - **Expected:** A box for the name opens.
  - **Notes:**

- [ ] **Step 3.** Type the first few letters of the name in the first row of the table.
  - **Expected:** Only people whose names contain those letters are listed.
  - **Notes:**

### FA-09: Metrics Count People

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-08.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Select **Metrics**.
  - **Expected:** The Metrics panel opens, offers the months to break down by, and gives the number of people with no mention of drafts.
  - **Notes:**

### FA-10: The Table Agrees With the Org Chart

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-09.

**Preconditions:** **Feature assignments** open, with **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Under the **Search** group, note the people with a **Search** label in the column for the month before the current one.
  - **Expected:** The people are listed under the **Search** group.
  - **Notes:**

- [ ] **Step 2.** Select **Org chart** in the left-hand menu.
  - **Expected:** The **Org chart** page opens.
  - **Notes:**

- [ ] **Step 3.** Select **Feature teams** in the switch at the top right.
  - **Expected:** The chart shows feature teams.
  - **Notes:**

- [ ] **Step 4.** Select the left arrow beside the timeline once.
  - **Expected:** The team led by the card that names **Search**, the lead and the members stacked under that card, are the same people as noted in step 1.
  - **Notes:**

### FA-11: Months Outside Someone's Employment Are Shaded

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-10.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Scroll sideways and down through the table.
  - **Expected:** Some people have shaded cells at the start or end of their row, for the months before they started or after they left. Shaded cells hold no labels.
  - **Notes:**

### FA-12: Readers Without Restricted Details See No Shading

**Account:** Resource Planner, `resource.planner@fathom.test`, changed from FA-11.

**Preconditions:** Signed in with this account. **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Scroll sideways and down through the table.
  - **Expected:** No cells are shaded.
  - **Notes:**

### FA-13: The Table Works From the Keyboard

**Account:** Resource Planner, `resource.planner@fathom.test`, the same as FA-12.

**Preconditions:** **Feature assignments** open.

- [ ] **Step 1.** Select a cell in the current month's column that holds a label.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] **Step 2.** Press the right arrow key.
  - **Expected:** The outline moves one cell right and the table scrolls to keep it in view, with the **Person** column staying in place.
  - **Notes:**

- [ ] **Step 3.** Press the down arrow key.
  - **Expected:** The outline moves one cell down and the table scrolls to keep it in view, with the month headings staying in place.
  - **Notes:**

- [ ] **Step 4.** Press Enter.
  - **Expected:** No box for editing opens in the cell.
  - **Notes:**

- [ ] **Step 5.** Type a letter.
  - **Expected:** Nothing is typed or changed in the cell.
  - **Notes:**

### FA-14: Readers Who Do Not See People Cannot Group by Manager

**Account:** Team Member, `team.member@fathom.test`, changed from FA-13.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select **Feature assignments** in the left-hand menu.
  - **Expected:** The button reads **Group by: Feature team**.
  - **Notes:**

- [ ] **Step 2.** Open the Group by menu.
  - **Expected:** It offers **Feature team** and **None**.
  - **Notes:**
